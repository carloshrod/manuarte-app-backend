import axios, { AxiosError } from 'axios';
import { Op } from 'sequelize';
import { sequelize } from '../../config/database';
import { ENV } from '../../config/env';
import { redis } from '../../config/redis';
import { ProductModel } from '../product/model';
import { ProductVariantModel } from '../product-variant/model';
import { StockItemModel } from '../stock-item/model';
import { StockModel } from '../stock/model';
import { ShopModel } from '../shop/model';
import { CountryModel } from '../country/model';
import { WhatsAppLogService } from './logging/log.service';
import { OpenAIService } from './openai.service';
import {
	formatPrice,
	normalizeText,
	stemTerm,
	SYNONYMS,
	SYNONYM_REPLACEMENTS,
} from './utils';
import { QuoteService } from '../quote/service';
import { QuoteModel } from '../quote/model';
import { QuoteStatus } from '../quote/types';
import { WhatsAppService } from '../whatsapp/service';
import { calculateTotals, formatCurrency } from '../docs/utils';
import { CustomerService } from '../customer/service';
import { CustomerModel } from '../customer/model';
import { CityService } from '../city/service';
import { CityModel } from '../city/model';
import { PersonModel } from '../person/model';
import { DocsService } from '../docs/service';
import { BillingService } from '../billing/service';
import { BillingModel } from '../billing/model';

const WHATSAPP_API_TIMEOUT_MS = 10_000;
const BUFFER_WAIT_MS = 5_000; // espera antes de procesar mensajes acumulados
const REPLY_DELAY_MS = 2_500; // delay para simular tiempo de escritura humano
const SESSION_TTL_SECONDS = 60 * 60 * 2; // 2 horas

interface BufferEntry {
	botPhoneNumberId: string;
	texts: string[];
	timer: ReturnType<typeof setTimeout>;
}

interface ProductListEntry {
	productId: string;
	name: string;
	description?: string;
	variants: Array<{
		variantId: string;
		stockItemId: string | null;
		name: string;
		totalQty: number;
		price: string | null;
	}>;
}

interface CartItem {
	productId: string;
	productVariantId?: string;
	stockItemId?: string | null;
	productName: string;
	variantName?: string;
	quantity: number;
	unitPrice: string | null;
	currency: string;
}

interface PendingQuoteFlow {
	step:
		| 'awaiting_customer_data'
		| 'awaiting_address'
		| 'awaiting_city_selection'
		| 'awaiting_confirmation';
	collectedData?: {
		fullName?: string;
		dni?: string;
		phoneNumber?: string;
		location?: string;
		cityId?: number;
		cityName?: string;
		customerId?: string;
		personId?: string;
	};
	cityCandidates?: Array<{ id: number; name: string; regionName: string }>;
}

interface UserSession {
	lastProductList?: ProductListEntry[];
	remainingProductList?: ProductListEntry[];
	awaitingMoreProducts?: boolean;
	lastSearchQuery?: string;
	lastCountryInfo?: {
		currency: string;
		stockIds: string[];
		shopId: string;
		isoCode: string;
	} | null;
	selectedProduct?: string;
	selectedVariantName?: string;
	lastActivityAt?: number;
	lastBotMessage?: string;
	cart?: CartItem[];
	pendingQuoteFlow?: PendingQuoteFlow | null;
	/** Cantidad capeada al stock cuando fue insuficiente; el siguiente "Sí" la confirma */
	pendingStockConfirmQty?: number;
}

const MAX_PRODUCT_RESULTS = 5;

export class WhatsAppAgentService {
	private messageBuffer = new Map<string, BufferEntry>();
	private processingQueue = new Map<string, Promise<void>>();
	private logService = new WhatsAppLogService();
	private openai = new OpenAIService();
	private quoteService = new QuoteService(QuoteModel);
	private docsService = new DocsService(
		this.quoteService,
		new BillingService(BillingModel),
	);
	private whatsAppService = new WhatsAppService();
	private customerService = new CustomerService(CustomerModel);
	private cityService = new CityService(CityModel);

	verifyWebhook = (mode: string, token: string, challenge: string) => {
		if (mode !== 'subscribe') {
			return { status: 403, message: 'Modo inválido' };
		}

		if (token !== ENV.WHATSAPP_VERIFY_TOKEN) {
			return { status: 403, message: 'Token de verificación inválido' };
		}

		return { status: 200, challenge };
	};

	receiveMessage = async (body: unknown) => {
		console.log('**************** receiving message ****************');
		const payload = body as {
			entry?: Array<{
				changes?: Array<{
					value?: {
						messages?: Array<{
							text?: { body?: string };
							from?: string;
							timestamp?: string;
							id?: string;
						}>;
						statuses?: unknown[];
						metadata?: { phone_number_id?: string };
					};
				}>;
			}>;
		};
		if (!payload?.entry) {
			console.warn('[WhatsApp Agent] Payload without entry, ignoring.');
			return { status: 200, message: 'Sin datos para procesar.' };
		}

		try {
			const entry = payload?.entry?.[0];
			const changes = entry?.changes?.[0];
			const value = changes?.value;
			const messages = value?.messages?.[0];

			if (value?.statuses) {
				console.log('[WhatsApp Agent] Status update event, ignoring.');
				return { status: 200, message: 'Status update ignorado.' };
			}

			const text = messages?.text?.body ?? null;
			const botPhoneNumberId = value?.metadata?.phone_number_id ?? null;
			const phoneNumber = messages?.from ?? null;
			const timestamp = messages?.timestamp ?? null;
			const message_id = messages?.id ?? null;

			if (timestamp) {
				const ageMs = Date.now() - Number(timestamp) * 1000;
				const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos
				if (ageMs > MAX_AGE_MS) {
					console.warn(
						`[WhatsApp Agent] Stale message (${Math.round(ageMs / 1000)}s old), ignoring.`,
					);
					return { status: 200, message: 'Mensaje antiguo ignorado.' };
				}
			}

			console.log(botPhoneNumberId);

			if (!botPhoneNumberId) {
				console.warn(
					'[WhatsApp Agent] Event without phone_number_id (status update?), ignoring.',
				);
				return { status: 200, message: 'Evento sin phoneNumberId del bot.' };
			}

			if (
				ENV.WHATSAPP_AGENT_PHONE_NUMBER_ID &&
				botPhoneNumberId !== ENV.WHATSAPP_AGENT_PHONE_NUMBER_ID
			) {
				console.log(
					'[WhatsApp Agent] phoneNumberId no coincide con el configurado, ignorando mensaje de:',
					phoneNumber,
				);
				return { status: 200, message: 'phoneNumberId no autorizado.' };
			}

			console.log('[WhatsApp Agent] Incoming message:', {
				text,
				botPhoneNumberId,
				phoneNumber,
				timestamp,
				message_id,
			});

			if (!messages) {
				console.warn('[WhatsApp Agent] Event without messages, ignoring.');
				return { status: 200, message: 'Evento sin mensajes.' };
			}

			if (!text) {
				console.warn(
					'[WhatsApp Agent] Event without text (status update?), ignoring.',
				);
				return { status: 200, message: 'Evento sin texto.' };
			}

			if (phoneNumber && botPhoneNumberId) {
				this.bufferMessage(phoneNumber, botPhoneNumberId, text);
			}
		} catch (error) {
			console.error('[WhatsApp Agent] Error processing message:', error);
			this.logService
				.logError({ context: 'receiveMessage', error })
				.catch(e =>
					console.error('[WhatsApp Agent] Failed to save error log:', e),
				);
			return { status: 500, message: 'Error interno del servidor.' };
		}
		return { status: 200, message: 'Mensaje recibido.' };
	};

	private bufferMessage = (
		phoneNumber: string,
		botPhoneNumberId: string,
		text: string,
	) => {
		const existing = this.messageBuffer.get(phoneNumber);

		if (existing) {
			clearTimeout(existing.timer);
			existing.texts.push(text);
		} else {
			this.messageBuffer.set(phoneNumber, {
				botPhoneNumberId,
				texts: [text],
				timer: setTimeout(() => {}, 0), // placeholder, se reemplaza abajo
			});
		}

		const entry = this.messageBuffer.get(phoneNumber)!;
		entry.timer = setTimeout(() => {
			this.messageBuffer.delete(phoneNumber);
			const combined = entry.texts.join(' ');
			console.log(
				`[WhatsApp Agent] Processing buffered messages from ${phoneNumber}: "${combined}"`,
			);
			this.processAndReply(phoneNumber, entry.botPhoneNumberId, combined).catch(
				err => {
					console.error('[WhatsApp Agent] Error in processAndReply:', err);
					this.logService
						.logError({ context: 'processAndReply', error: err, phoneNumber })
						.catch(e =>
							console.error('[WhatsApp Agent] Failed to save error log:', e),
						);
				},
			);
		}, BUFFER_WAIT_MS);
	};

	private processAndReply = async (
		phoneNumber: string,
		botPhoneNumberId: string,
		text: string,
	) => {
		// Cola serial por usuario: garantiza que no se procesen dos mensajes del
		// mismo número en paralelo, evitando que un handler sobrescriba los
		// cambios de sesión (carrito) que hizo otro handler concurrente.
		const prev = this.processingQueue.get(phoneNumber);
		let resolveCurrent!: () => void;
		const current = new Promise<void>(resolve => {
			resolveCurrent = resolve;
		});
		this.processingQueue.set(phoneNumber, current);
		if (prev) await prev;

		try {
			await this.doProcessAndReply(phoneNumber, botPhoneNumberId, text);
		} finally {
			resolveCurrent();
			// Limpiar la entrada solo si sigue siendo la nuestra (no hay otra en cola)
			if (this.processingQueue.get(phoneNumber) === current) {
				this.processingQueue.delete(phoneNumber);
			}
		}
	};

	private doProcessAndReply = async (
		phoneNumber: string,
		botPhoneNumberId: string,
		text: string,
	) => {
		const normalizedText = normalizeText(text);
		const countryInfo = await this.detectCountryFromPhone(phoneNumber);
		const countryPrefix = countryInfo
			? `+${phoneNumber.startsWith('593') ? '593' : '57'}`
			: null;

		const raw = await redis.get(`session:${phoneNumber}`);
		const session: UserSession = raw ? JSON.parse(raw) : {};
		const now = Date.now();
		const RESUMPTION_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutos
		const hasActiveList = (session.lastProductList?.length ?? 0) > 0;
		const isFirstInteraction = !session.lastActivityAt;
		const isResumption =
			!isFirstInteraction &&
			now - session.lastActivityAt! > RESUMPTION_THRESHOLD_MS &&
			hasActiveList;

		session.lastActivityAt = now;
		await redis.set(
			`session:${phoneNumber}`,
			JSON.stringify(session),
			'EX',
			SESSION_TTL_SECONDS,
		);

		// ── Interceptor: flujo de cotización activo ──
		if (session.pendingQuoteFlow) {
			const quoteReply = await this.handleQuoteFlowStep(
				phoneNumber,
				botPhoneNumberId,
				text,
				normalizedText,
				session,
				countryInfo,
			);
			if (quoteReply !== null) {
				session.lastBotMessage = quoteReply;
				await redis.set(
					`session:${phoneNumber}`,
					JSON.stringify(session),
					'EX',
					SESSION_TTL_SECONDS,
				);
				const countryPrefix = countryInfo
					? `+${phoneNumber.startsWith('593') ? '593' : '57'}`
					: null;
				await new Promise(resolve => setTimeout(resolve, REPLY_DELAY_MS));
				await this.sendReply(phoneNumber, botPhoneNumberId, quoteReply);
				this.logService
					.logMessage({
						phoneNumber,
						botPhoneNumberId,
						direction: 'outbound',
						text: quoteReply,
						intent: 'quote_flow',
						countryPrefix,
					})
					.catch(err =>
						console.error('[WhatsApp Agent] Error saving outbound log:', err),
					);
				return;
			}
		}

		const selectionIndex = this.detectSelection(normalizedText);
		const nameSelectionIndex =
			selectionIndex === null && hasActiveList
				? this.detectSelectionByName(
						normalizedText,
						session.lastProductList ?? [],
					)
				: null;
		const effectiveSelectionIndex = selectionIndex ?? nameSelectionIndex;

		// Checks determinísticos: show_more y affirmation también los resuelve el backend
		const deterministicIntent = this.detectDeterministicIntent(normalizedText);

		let intent: string;
		let aiSearchQuery: string | undefined;
		let aiSelectionIndexes: number[] | undefined;
		let aiVariantHint: string | undefined;
		let aiQuantity: number | undefined;
		let aiQuantities: number[] | undefined;
		let aiRemoveProductHint: string | undefined;
		let aiAddProductHint: string | undefined;
		let aiCartEdits:
			| Array<{ productHint: string; quantity: number }>
			| undefined;

		if (isResumption && deterministicIntent !== 'search_product') {
			intent = 'resumption';
		} else if (deterministicIntent !== null) {
			intent = deterministicIntent;
		} else {
			// Helper: true si el texto menciona palabras de un producto DIFERENTE al selectedProduct,
			// tanto en el carrito como en la lista activa.
			const checkMentionsDifferentProduct = (): boolean =>
				!!(
					session.selectedProduct &&
					(session.cart?.some(item => {
						if (item.productName === session.selectedProduct) return false;
						const words = normalizeText(item.productName)
							.split(/\s+/)
							.filter(w => w.length > 3);
						return words.some(w => normalizedText.includes(w));
					}) ||
						session.lastProductList?.some(p => {
							if (p.name === session.selectedProduct) return false;
							const words = normalizeText(p.name)
								.split(/\s+/)
								.filter(w => w.length > 3);
							return words.some(w => normalizedText.includes(w));
						}))
				);

			// Deterministic override (PRIORITARIO): si detectSelectionByName encontró un
			// producto DIFERENTE al seleccionado, forzar select_product ANTES de los bloques
			// de cantidad/peso. Esto evita que "6 kilos de la cca" se interprete como
			// cantidad de KARITE cuando CCA es un producto diferente en la lista.
			// Se ejecuta aquí porque checkMentionsDifferentProduct filtra palabras de <=3
			// caracteres (ej: "cca") y no las detecta como producto diferente.
			if (
				session.selectedProduct &&
				hasActiveList &&
				effectiveSelectionIndex !== null
			) {
				const mentionedProduct =
					session.lastProductList?.[effectiveSelectionIndex - 1];
				if (
					mentionedProduct &&
					mentionedProduct.name !== session.selectedProduct
				) {
					intent = 'select_product';
					aiSelectionIndexes = [effectiveSelectionIndex];

					// Extraer cantidad del texto (ej: "tambien dame 2 de la de avena")
					const qtyMatch = normalizedText.match(/\b(\d+)\b/);
					if (qtyMatch) {
						const parsedQty = parseInt(qtyMatch[1], 10);
						if (parsedQty > 0 && parsedQty <= 1000) {
							// Verificar si es peso (ej: "2 kilos") → convertir a unidades
							const requestedGramsDet =
								this.detectRequestedWeightGrams(normalizedText);
							if (requestedGramsDet !== null) {
								const resolvedV = this.resolveVariant(
									mentionedProduct,
									undefined,
									normalizedText,
								);
								const vGrams = resolvedV
									? this.parseVariantWeightGrams(resolvedV.name)
									: null;
								if (vGrams !== null) {
									aiQuantity = Math.ceil(requestedGramsDet / vGrams);
								} else {
									aiQuantity = parsedQty;
								}
							} else {
								aiQuantity = parsedQty;
							}
						}
					}

					console.log(
						`[WhatsApp Agent] Deterministic select_product for different product: "${mentionedProduct.name}" (idx ${effectiveSelectionIndex})` +
							(aiQuantity !== undefined ? `, qty: ${aiQuantity}` : ''),
					);
				}
			}

			// Helper: true si el texto menciona nombres de variante de un producto
			// multi-variante en la lista activa (útil para evitar que "quiero 1 rectangular"
			// se interprete como qty=1 del producto ya seleccionado).
			const mentionsMultiVariantNames = (): boolean => {
				if (!hasActiveList) return false;
				return (session.lastProductList ?? []).some(p => {
					if (p.variants.length <= 1) return false;
					return p.variants.some(v => {
						const vWords = normalizeText(v.name)
							.split(/\s+/)
							.filter(w => w.length > 2);
						return vWords.some(w => normalizedText.includes(w));
					});
				});
			};

			// Detección con contexto de sesión: "dame/quiero/ponme X" cuando hay producto activo
			// Esto evita que la IA clasifique como "unknown" y pierda el contexto del producto
			// NOTA: no aplica cuando el número va seguido de unidad de peso (ej: "quiero 1 kilo")
			// NOTA: no aplica cuando el texto menciona variantes de un producto multi-variante
			const qtyCommandMatch = !intent!
				? normalizedText.match(
						/^(?:dame|quiero|pon|ponme|agrega|necesito|llevo|llevame|mandame|enviame)\s+(\d+)(?!\s*(?:kilo[s]?|kg|gramo[s]?|gr|g\b))(?:\s|$)/i,
					)
				: null;
			if (qtyCommandMatch && !mentionsMultiVariantNames()) {
				const extractedQty = parseInt(qtyCommandMatch[1], 10);
				if (session.selectedProduct && hasActiveList) {
					// Verificar que el mensaje no mencione un producto DIFERENTE al seleccionado.
					// Si lo hace, dejar que la IA resuelva (puede ser edit_cart con otro producto).
					if (!checkMentionsDifferentProduct()) {
						// Producto ya en contexto: interpretar como cantidad de ese producto
						intent = 'product_followup';
						aiQuantity = extractedQty;
						console.log(
							`[WhatsApp Agent] Context qty for selected product: ${extractedQty}`,
						);
					}
				} else if (
					hasActiveList &&
					(session.lastProductList?.length ?? 0) === 1
				) {
					// Un solo producto en lista: selección implícita con cantidad
					intent = 'select_product';
					aiSelectionIndexes = [1];
					aiQuantity = extractedQty;
					console.log(
						`[WhatsApp Agent] Context qty → select_product [1] qty=${extractedQty}`,
					);
				}
			}

			// Detección de cantidad por peso (ej: "quiero 1 kilo", "dame 500 gramos")
			// Aplica cuando hay producto seleccionado O cuando la lista activa tiene exactamente
			// 1 producto (el cliente implícitamente se refiere a ese).
			if (!intent! && hasActiveList) {
				const weightProductEntry = session.selectedProduct
					? session.lastProductList?.find(
							p => p.name === session.selectedProduct,
						)
					: session.lastProductList?.length === 1
						? session.lastProductList[0]
						: undefined;
				// No aplicar la conversión por peso si el mensaje menciona explícitamente
				// un producto distinto al seleccionado (ej: "5 kilos de cera" cuando selectedProduct es Ácido Esteárico).
				if (weightProductEntry && !checkMentionsDifferentProduct()) {
					const requestedGrams =
						this.detectRequestedWeightGrams(normalizedText);
					if (requestedGrams !== null) {
						const resolved = this.resolveVariantByWeight(
							weightProductEntry.variants,
							requestedGrams,
						);
						if (resolved) {
							intent = 'product_followup';
							aiQuantity = resolved.units;
							session.selectedProduct = weightProductEntry.name;
							session.selectedVariantName = resolved.variant.name;
							console.log(
								`[WhatsApp Agent] Weight request: ${requestedGrams}g → ${resolved.units}x "${resolved.variant.name}" (product: ${weightProductEntry.name})`,
							);
						}
					}
				}
			}

			if (!intent!) {
				// Pasar siempre la lista activa al clasificador de IA.
				// Cuando hay un producto seleccionado se añade nota para que la IA distinga
				// entre "menciona otro producto de la lista" vs "dice una cantidad".
				try {
					// Suppress active product list when message clearly targets a cart item with an
					// edit verb → prevents AI from picking "select_product" by index
					const suppressActiveList = !!(
						hasActiveList &&
						session.cart?.length &&
						/\b(agrega[r]?|a[nñ]ade[r]?|sum[ae][r]?|quita[r]?|saca[r]?)\b/i.test(
							normalizedText,
						) &&
						session.cart.some(item => {
							const words = normalizeText(item.productName)
								.split(/\s+/)
								.filter(w => w.length > 3);
							return words.some(w => normalizedText.includes(w));
						})
					);

					const activeProductsList =
						hasActiveList && !suppressActiveList
							? (session.lastProductList ?? []).map((p, i) => {
									const variantNames = p.variants
										.map(v => v.name)
										.filter(Boolean);
									const label =
										variantNames.length === 1
											? `${p.name} – ${variantNames[0]}`
											: variantNames.length > 1
												? `${p.name} (variantes: ${variantNames.join(', ')})`
												: p.name;
									return { index: i + 1, label };
								})
							: undefined;

					const aiResult = await this.openai.detectIntentWithAI(
						text,
						hasActiveList && !suppressActiveList,
						activeProductsList,
						session.awaitingMoreProducts,
						session.selectedProduct,
						session.cart,
					);

					// unknown + producto activo → continuar conversación del producto
					// unknown + sin contexto → saludo genérico
					intent =
						aiResult.intent === 'unknown'
							? session.selectedProduct
								? 'product_followup'
								: 'greeting'
							: aiResult.intent;

					aiSearchQuery = aiResult.searchQuery;
					aiSelectionIndexes = aiResult.selectionIndexes;
					aiVariantHint = aiResult.variantHint;
					aiQuantity = aiResult.quantity;
					aiQuantities = aiResult.quantities;
					aiRemoveProductHint = aiResult.removeProductHint;
					aiAddProductHint = aiResult.addProductHint;
					aiCartEdits = aiResult.cartEdits;
					console.log(
						`[WhatsApp Agent] AI intent: ${aiResult.intent}` +
							(aiSearchQuery ? `, searchQuery: "${aiSearchQuery}"` : '') +
							(aiSelectionIndexes
								? `, selection: [${aiSelectionIndexes}]`
								: '') +
							(aiVariantHint ? `, variantHint: "${aiVariantHint}"` : '') +
							(aiQuantity !== undefined ? `, qty: ${aiQuantity}` : '') +
							(aiAddProductHint ? `, addHint: "${aiAddProductHint}"` : '') +
							(aiRemoveProductHint
								? `, removeHint: "${aiRemoveProductHint}"`
								: '') +
							(aiCartEdits
								? `, cartEdits: ${JSON.stringify(aiCartEdits)}`
								: ''),
					);

					// Si detectó búsqueda nueva → limpiar producto seleccionado
					if (intent === 'search_product') {
						session.selectedProduct = undefined;
					}
				} catch (err) {
					console.warn(
						'[WhatsApp Agent] AI intent detection failed, falling back to rules:',
						err,
					);
					if (effectiveSelectionIndex !== null && hasActiveList) {
						intent = 'select_product';
						aiSelectionIndexes = [effectiveSelectionIndex];
					} else if (session.selectedProduct) {
						intent = 'product_followup';
					} else {
						intent = this.detectIntent(normalizedText);
					}
				}
			} // end if (!intent!)
		}

		// Reclasificar: edit_cart + addProductHint sin coincidencia en carrito → search_product
		// Ocurre cuando el cliente pide un producto con cantidad pero el carrito está vacío
		// o no tiene ese producto (ej: "Necesito 4 kilos de cera de palma").
		if (
			intent === 'edit_cart' &&
			aiAddProductHint &&
			!session.cart?.some(item => {
				const fullName = normalizeText(
					item.variantName
						? `${item.productName} ${item.variantName}`
						: item.productName,
				);
				const tokens = normalizeText(aiAddProductHint)
					.split(/\s+/)
					.filter(t => t.length > 2);
				return tokens.some(t => fullName.includes(t));
			})
		) {
			console.log(
				`[WhatsApp Agent] Reclassifying edit_cart → search_product: hint "${aiAddProductHint}" not found in cart`,
			);
			intent = 'search_product';
			// Filtrar preposiciones y palabras cortas del hint antes de usarlo como
			// search query, para evitar que "de" contamine el fallback OR en buildProductReply
			const cleanedHint = normalizeText(aiAddProductHint)
				.split(/\s+/)
				.filter(w => w.length > 2)
				.join(' ');
			aiSearchQuery = cleanedHint || undefined;
			session.selectedProduct = undefined;
		}

		console.log(
			`[WhatsApp Agent] Intent detected: ${intent} (resumption: ${isResumption})`,
		);

		this.logService
			.logMessage({
				phoneNumber,
				botPhoneNumberId,
				direction: 'inbound',
				text,
				intent,
				countryPrefix,
			})
			.catch(err => {
				console.error(
					'[WhatsApp Agent] Error saving inbound message log:',
					err,
				);
				this.logService
					.logError({
						context: 'logMessage:inbound',
						error: err,
						phoneNumber,
						rawText: text,
					})
					.catch(e =>
						console.error('[WhatsApp Agent] Failed to save error log:', e),
					);
			});

		let replyText: string;

		if (intent === 'resumption') {
			const lastProduct = session.lastProductList![0];
			const currency =
				session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
			replyText = await this.openai
				.generateReply({
					userMessage: text,
					resumptionProduct: lastProduct,
					currency,
				})
				.catch(() => this.buildResumptionReply(lastProduct));
		} else if (intent === 'select_product') {
			const indexes = aiSelectionIndexes ?? [];
			const selectedItems = indexes
				.map(i => session.lastProductList?.[i - 1])
				.filter((p): p is ProductListEntry => !!p);

			if (selectedItems.length > 0) {
				const currency =
					session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';

				// Resolver variante del primer producto (para selectedVariantName de sesión)
				const firstVariantHint = aiVariantHint;
				const resolvedVariant = this.resolveVariant(
					selectedItems[0],
					firstVariantHint,
					normalizedText,
				);
				session.selectedProduct = selectedItems[0].name;
				session.selectedVariantName = resolvedVariant?.name;

				// Si el cliente pidió por peso (ej: "4 kilos"), convertir a unidades
				// usando el peso de la variante (ej: MEDIO KILO = 500g → 4000g / 500g = 8 uds)
				const requestedGramsInSelection =
					this.detectRequestedWeightGrams(normalizedText);

				let primaryItemQty: number | undefined;
				let primaryRequestedQty: number | undefined;
				let primaryCappedQty: number | undefined;

				// Agregar cada producto seleccionado al carrito con su cantidad individual
				for (let i = 0; i < selectedItems.length; i++) {
					const item = selectedItems[i];
					const itemVariantHint = i === 0 ? aiVariantHint : undefined;
					const itemVariant =
						i === 0
							? resolvedVariant
							: this.resolveVariant(item, itemVariantHint, normalizedText);
					// Cantidad: si hay quantities[] usamos la de este índice;
					// si hay una sola aiQuantity la usamos para todos;
					// si el producto tiene solo 1 unidad disponible, forzamos 1.
					const itemTotalQty = (
						itemVariant ? [itemVariant] : item.variants
					).reduce((sum, v) => sum + v.totalQty, 0);

					// Conversión peso→unidades (igual que en edit_cart y product_followup)
					const variantGramsForItem = itemVariant
						? this.parseVariantWeightGrams(itemVariant.name)
						: null;
					const weightBasedQty =
						requestedGramsInSelection !== null && variantGramsForItem !== null
							? Math.ceil(requestedGramsInSelection / variantGramsForItem)
							: undefined;

					const itemQty =
						weightBasedQty ??
						aiQuantities?.[i] ??
						aiQuantity ??
						(itemTotalQty === 1 ? 1 : undefined);

					// Limitar al stock disponible
					const cappedQty =
						itemQty !== undefined ? Math.min(itemQty, itemTotalQty) : undefined;
					const stockExceededForItem =
						itemQty !== undefined &&
						cappedQty !== undefined &&
						cappedQty < itemQty;

					if (i === 0) {
						primaryCappedQty = cappedQty;
						primaryItemQty = stockExceededForItem ? undefined : cappedQty;
						primaryRequestedQty = stockExceededForItem ? itemQty : undefined;
					}
					// Solo agregar al carrito si el stock alcanza para lo pedido
					if (cappedQty && !stockExceededForItem) {
						this.addToCart(session, item, cappedQty, currency, itemVariant);
					}
				}

				await redis.set(
					`session:${phoneNumber}`,
					JSON.stringify(session),
					'EX',
					SESSION_TTL_SECONDS,
				);
				const selectedProductForReply = resolvedVariant
					? {
							...selectedItems[0],
							variants: [resolvedVariant],
						}
					: selectedItems[0];

				// Construir items con variantes resueltas para multi-selección
				const resolvedSelectedItems =
					selectedItems.length > 1
						? selectedItems.map((item, i) => {
								const hint = i === 0 ? aiVariantHint : undefined;
								const v =
									i === 0
										? resolvedVariant
										: this.resolveVariant(item, hint, normalizedText);
								return v ? { ...item, variants: [v] } : item;
							})
						: undefined;

				replyText = await this.openai
					.generateReply({
						userMessage: text,
						selectedProduct: selectedProductForReply,
						selectedProducts: resolvedSelectedItems,
						quantity: aiQuantities
							? undefined
							: (primaryItemQty ?? primaryCappedQty),
						requestedQuantity: primaryRequestedQty,
						currency,
					})
					.catch(() =>
						this.buildSelectionReply(selectedProductForReply, currency),
					);
			} else {
				const count = session.lastProductList!.length;
				replyText = `Solo tengo ${count} opción${count !== 1 ? 'es' : ''} en la lista. Dime un número del 1 al ${count}.`;
			}
		} else if (intent === 'search_product') {
			session.selectedProduct = undefined;
			const result = await this.buildProductReply(
				normalizedText,
				countryInfo,
				aiSearchQuery,
			);
			console.log('result *******************************', result);
			session.lastProductList = result.products;
			session.remainingProductList = result.remainingProducts;
			session.awaitingMoreProducts = result.remainingProducts.length > 0;
			session.lastSearchQuery = aiSearchQuery ?? normalizedText;
			session.lastCountryInfo = countryInfo;

			const currency = countryInfo?.currency ?? 'USD';

			// Auto-agregar al carrito si se mencionó cantidad y el producto es inequívoco.
			// Aplica cuando el cliente pide directamente un producto con cantidad pero no estaba
			// en el carrito (ej: "Necesito 4 kilos de cera de palma" reclasificado de edit_cart).
			let autoAddedProduct: ProductListEntry | undefined;
			let autoAddedQty: number | undefined;
			let autoAddedVariant: ProductListEntry['variants'][0] | undefined;
			let autoAddedRequestedQty: number | undefined;
			let autoAddedStockExceededNote: string | undefined;

			if (
				aiQuantity !== undefined &&
				result.products.length === 1 &&
				result.productFound
			) {
				const product = result.products[0];
				const requestedGrams = this.detectRequestedWeightGrams(normalizedText);

				if (requestedGrams !== null) {
					// Cantidad expresada en peso (ej: "4 kilos") → elegir variante óptima
					const resolved = this.resolveVariantByWeight(
						product.variants,
						requestedGrams,
					);
					if (resolved) {
						const cappedUnits = Math.min(
							resolved.units,
							resolved.variant.totalQty,
						);
						const stockExceeded = cappedUnits < resolved.units;
						if (!stockExceeded) {
							this.addToCart(
								session,
								product,
								cappedUnits,
								currency,
								resolved.variant,
							);
						}
						session.selectedProduct = product.name;
						session.selectedVariantName = resolved.variant.name;
						autoAddedProduct = product;
						autoAddedQty = cappedUnits;
						autoAddedVariant = resolved.variant;
						if (stockExceeded) {
							const variantGrams = this.parseVariantWeightGrams(
								resolved.variant.name,
							);
							const requestedKg = requestedGrams / 1000;
							const availableGrams =
								variantGrams !== null ? cappedUnits * variantGrams : null;
							const availableKg =
								availableGrams !== null ? availableGrams / 1000 : null;
							const availableLabel =
								availableKg !== null
									? `${availableKg % 1 === 0 ? availableKg : availableKg.toFixed(1)} kg (${cappedUnits} unidades de ${resolved.variant.name})`
									: `${cappedUnits} unidades de ${resolved.variant.name}`;
							const requestedLabel = `${requestedKg % 1 === 0 ? requestedKg : requestedKg.toFixed(1)} kg`;
							autoAddedStockExceededNote = `El cliente pidió ${requestedLabel} pero solo hay ${availableLabel} disponible(s). NO confirmes el pedido ni calcules total. Informa brevemente la cantidad disponible en kg y pregunta si quiere esa cantidad. Varía la frase: "Solo tenemos X kg, ¿quieres esas?" u otra variación natural. NUNCA uses frases como "te lo llevo", "te la llevo" ni similares.`;
							session.pendingStockConfirmQty = cappedUnits;
						}
						console.log(
							`[WhatsApp Agent] Auto-added to cart from search (weight): ${product.name} – ${resolved.variant.name} x${cappedUnits} (${requestedGrams}g → ${resolved.units} units, capped: ${cappedUnits})`,
						);
					}
				} else if (product.variants.length === 1) {
					// Producto con una sola variante → agregar directamente
					const variant = product.variants[0];
					const cappedUnits = Math.min(aiQuantity, variant.totalQty);
					const stockExceeded = cappedUnits < aiQuantity;
					if (!stockExceeded) {
						this.addToCart(session, product, cappedUnits, currency, variant);
					}
					session.selectedProduct = product.name;
					session.selectedVariantName = variant.name;
					autoAddedProduct = product;
					autoAddedQty = cappedUnits;
					autoAddedVariant = variant;
					if (stockExceeded) {
						autoAddedRequestedQty = aiQuantity;
						session.pendingStockConfirmQty = cappedUnits;
					}
					console.log(
						`[WhatsApp Agent] Auto-added to cart from search (single variant): ${product.name} – ${variant.name} x${cappedUnits}`,
					);
				} else if (aiVariantHint) {
					// Múltiples variantes + hint de presentación → resolver y agregar directamente
					const resolved = this.resolveVariant(
						product,
						aiVariantHint,
						normalizedText,
					);
					if (resolved) {
						const cappedUnits = Math.min(aiQuantity, resolved.totalQty);
						const stockExceeded = cappedUnits < aiQuantity;
						if (!stockExceeded) {
							this.addToCart(session, product, cappedUnits, currency, resolved);
						}
						session.selectedProduct = product.name;
						session.selectedVariantName = resolved.name;
						autoAddedProduct = product;
						autoAddedQty = cappedUnits;
						autoAddedVariant = resolved;
						if (stockExceeded) {
							autoAddedRequestedQty = aiQuantity;
							session.pendingStockConfirmQty = cappedUnits;
						}
						console.log(
							`[WhatsApp Agent] Auto-added to cart from search (variant hint "${aiVariantHint}"): ${product.name} – ${resolved.name} x${cappedUnits}`,
						);
					}
				}
				// Si hay múltiples variantes sin coincidencia de peso ni hint → no auto-agregar,
				// mostrar opciones al cliente para que elija.
			}

			await redis.set(
				`session:${phoneNumber}`,
				JSON.stringify(session),
				'EX',
				SESSION_TTL_SECONDS,
			);

			if (autoAddedProduct && autoAddedQty !== undefined) {
				const productForReply = autoAddedVariant
					? { ...autoAddedProduct, variants: [autoAddedVariant] }
					: autoAddedProduct;
				replyText = await this.openai
					.generateReply({
						userMessage: text,
						selectedProduct: productForReply,
						quantity: autoAddedQty,
						requestedQuantity: autoAddedRequestedQty,
						stockExceededNote: autoAddedStockExceededNote,
						currency,
					})
					.catch(() => result.replyText);
			} else {
				replyText = await this.openai
					.generateReply({
						userMessage: text,
						products: result.products.length > 0 ? result.products : undefined,
						hasMoreProducts: result.remainingProducts.length > 0,
						isFirstInteraction,
						currency,
						outOfStockProductName: result.outOfStockProductName,
					})
					.catch(() => result.replyText);
			}

			// Log detallado de productos devueltos
			try {
				console.log(
					'[WhatsApp Agent] Productos devueltos al cliente:',
					(result.products ?? []).map(p => ({
						id: p.productId,
						nombre: p.name,
						descripcion: p.description,
						variantes: p.variants.map(v => ({
							id: v.variantId,
							nombre: v.name,
							stock: v.totalQty,
							precio: v.price,
						})),
					})),
				);
			} catch (e) {
				console.error(
					'[WhatsApp Agent] Error loggeando productos devueltos:',
					e,
				);
			}

			this.logService
				.logQuery({
					phoneNumber,
					botPhoneNumberId,
					rawText: text,
					searchTerms: result.searchTerms,
					productFound: result.productFound,
					suggestionsShown: result.suggestionsShown,
					replyText,
					countryPrefix,
				})
				.catch(err => {
					console.error('[WhatsApp Agent] Error saving query log:', err);
					this.logService
						.logError({
							context: 'logQuery',
							error: err,
							phoneNumber,
							rawText: text,
						})
						.catch(e =>
							console.error('[WhatsApp Agent] Failed to save error log:', e),
						);
				});
		} else if (intent === 'show_more') {
			const currency =
				session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
			if (session.awaitingMoreProducts) {
				const nextBatch = (session.remainingProductList ?? []).slice(
					0,
					MAX_PRODUCT_RESULTS,
				);
				const newRemaining = (session.remainingProductList ?? []).slice(
					MAX_PRODUCT_RESULTS,
				);
				session.lastProductList = [
					...(session.lastProductList ?? []),
					...nextBatch,
				];
				session.remainingProductList = newRemaining;
				session.awaitingMoreProducts = newRemaining.length > 0;
				await redis.set(
					`session:${phoneNumber}`,
					JSON.stringify(session),
					'EX',
					SESSION_TTL_SECONDS,
				);
				replyText = await this.openai
					.generateReply({
						userMessage: text,
						products: nextBatch,
						hasMoreProducts: newRemaining.length > 0,
						isShowingMore: true,
						currency,
					})
					.catch(() => 'Aquí hay más opciones, dime cuál te interesa.');
			} else if (session.lastSearchQuery) {
				// No hay productos en cola pero sí hubo una búsqueda previa: rehacer con query limpio
				session.selectedProduct = undefined;
				const result = await this.buildProductReply(
					normalizeText(session.lastSearchQuery),
					countryInfo ?? session.lastCountryInfo ?? null,
					session.lastSearchQuery,
				);
				session.lastProductList = result.products;
				session.remainingProductList = result.remainingProducts;
				session.awaitingMoreProducts = result.remainingProducts.length > 0;
				session.lastCountryInfo =
					countryInfo ?? session.lastCountryInfo ?? null;
				await redis.set(
					`session:${phoneNumber}`,
					JSON.stringify(session),
					'EX',
					SESSION_TTL_SECONDS,
				);
				replyText = await this.openai
					.generateReply({
						userMessage: text,
						products: result.products.length > 0 ? result.products : undefined,
						hasMoreProducts: result.remainingProducts.length > 0,
						isShowingMore: true,
						currency,
					})
					.catch(() => result.replyText);
			} else {
				replyText =
					'No tengo más opciones disponibles en este momento. ¿Puedo ayudarte con otra cosa?';
			}
		} else if (intent === 'objection') {
			const currency =
				session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
			const selectedProductEntry = session.lastProductList?.find(
				p => p.name === session.selectedProduct,
			);
			replyText = await this.openai
				.generateReply({
					userMessage: text,
					intent: 'objection',
					selectedProduct: selectedProductEntry,
					products: session.lastProductList?.length
						? session.lastProductList
						: undefined,
					currency,
				})
				.catch(() => 'Sin problema, aquí estaré cuando lo necesites. 🙌');
		} else if (intent === 'affirmation') {
			const currency =
				session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
			// Si hay un producto en contexto (seleccionado o único en la lista), tratar como confirmación de compra
			const affirmationProduct = session.selectedProduct
				? session.lastProductList?.find(p => p.name === session.selectedProduct)
				: session.lastProductList?.length === 1
					? session.lastProductList[0]
					: undefined;
			if (affirmationProduct) {
				if (!session.selectedProduct) {
					session.selectedProduct = affirmationProduct.name;
				}
				const sessionVariantAff = session.selectedVariantName
					? affirmationProduct.variants.find(
							v => v.name === session.selectedVariantName,
						)
					: undefined;
				const relevantVariants = sessionVariantAff
					? [sessionVariantAff]
					: affirmationProduct.variants;
				const totalQtyAff = relevantVariants.reduce(
					(sum, v) => sum + v.totalQty,
					0,
				);
				const impliedQty = totalQtyAff === 1 ? 1 : undefined;
				const bareNumberQtyAff = /^\d+$/.test(normalizedText.trim())
					? parseInt(normalizedText.trim(), 10)
					: undefined;
				// Extrae cantidad del texto completo cuando el intent fue determinístico
				// (aiQuantity no disponible) p. ej. "sí, dame 5"
				const inlineQtyMatch = /\b(\d+)\b/.exec(normalizedText);
				const inlineQty = inlineQtyMatch
					? parseInt(inlineQtyMatch[1], 10)
					: undefined;
				const pendingQty = session.pendingStockConfirmQty;
				if (pendingQty !== undefined)
					session.pendingStockConfirmQty = undefined;
				const effectiveQtyAff =
					aiQuantity ??
					bareNumberQtyAff ??
					inlineQty ??
					impliedQty ??
					pendingQty;
				if (effectiveQtyAff) {
					this.addToCart(
						session,
						affirmationProduct,
						effectiveQtyAff,
						currency,
						sessionVariantAff,
					);
				}
				await redis.set(
					`session:${phoneNumber}`,
					JSON.stringify(session),
					'EX',
					SESSION_TTL_SECONDS,
				);
				const productForAffReply = sessionVariantAff
					? { ...affirmationProduct, variants: [sessionVariantAff] }
					: affirmationProduct;
				replyText = await this.openai
					.generateReply({
						userMessage: text,
						selectedProduct: productForAffReply,
						quantity: effectiveQtyAff,
						lastBotMessage: session.lastBotMessage,
						currency,
					})
					.catch(() => 'Claro, ¿en qué te puedo ayudar?');
			} else {
				replyText = await this.openai
					.generateReply({
						userMessage: text,
						intent: 'affirmation',
						lastBotMessage: session.lastBotMessage,
						products: session.lastProductList?.length
							? session.lastProductList
							: undefined,
						currency,
					})
					.catch(() => 'Claro, ¿en qué te puedo ayudar?');
			}
		} else if (intent === 'general_question') {
			replyText = await this.openai
				.generateReply({
					userMessage: text,
					intent: 'general_question',
					isFirstInteraction,
				})
				.catch(
					() =>
						'Para esa consulta te recomiendo hablar directamente con nuestro equipo. ¿Te ayudo con algo más?',
				);
		} else if (intent === 'product_followup') {
			// El cliente ya eligió un producto — continuar la conversación con ese contexto
			const selectedProductEntry = session.lastProductList?.find(
				p => p.name === session.selectedProduct,
			);
			const currency =
				session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
			const sessionVariant =
				selectedProductEntry && session.selectedVariantName
					? selectedProductEntry.variants.find(
							v => v.name === session.selectedVariantName,
						)
					: undefined;
			const productForReply =
				selectedProductEntry && sessionVariant
					? { ...selectedProductEntry, variants: [sessionVariant] }
					: selectedProductEntry;
			if (selectedProductEntry) {
				const totalQtyFollowup = (
					sessionVariant ? [sessionVariant] : selectedProductEntry.variants
				).reduce((sum, v) => sum + v.totalQty, 0);
				const bareNumberQtyFollowup = /^\d+$/.test(normalizedText.trim())
					? parseInt(normalizedText.trim(), 10)
					: undefined;
				const effectiveQtyFollowup =
					aiQuantity ??
					bareNumberQtyFollowup ??
					(totalQtyFollowup === 1 ? 1 : undefined);

				// Limitar al stock disponible
				const cappedQtyFollowup =
					effectiveQtyFollowup !== undefined
						? Math.min(effectiveQtyFollowup, totalQtyFollowup)
						: undefined;
				const requestedQtyFollowup =
					effectiveQtyFollowup !== undefined &&
					cappedQtyFollowup !== undefined &&
					cappedQtyFollowup < effectiveQtyFollowup
						? effectiveQtyFollowup
						: undefined;

				// Solo agregar al carrito si el stock alcanza para lo pedido
				if (cappedQtyFollowup && !requestedQtyFollowup) {
					this.addToCart(
						session,
						selectedProductEntry,
						cappedQtyFollowup,
						currency,
						sessionVariant,
					);
				}
				replyText = await this.openai
					.generateReply({
						userMessage: text,
						selectedProduct: productForReply,
						lastBotMessage: session.lastBotMessage,
						quantity: cappedQtyFollowup,
						requestedQuantity: requestedQtyFollowup,
						currency,
					})
					.catch(() => 'Claro, ¿en qué más te puedo ayudar?');
			} else {
				replyText = await this.openai
					.generateReply({
						userMessage: text,
						selectedProduct: productForReply,
						lastBotMessage: session.lastBotMessage,
						quantity: aiQuantity,
						currency,
					})
					.catch(() => 'Claro, ¿en qué más te puedo ayudar?');
			}
		} else if (intent === 'edit_cart') {
			console.log(
				`[WhatsApp Agent] === EDIT_CART HANDLER === addHint: ${aiAddProductHint}, qty: ${aiQuantity}, removeHint: ${aiRemoveProductHint}, cartEdits: ${JSON.stringify(aiCartEdits)}`,
			);
			const currency =
				session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
			let removedProductName: string | undefined;
			let addedProductEntry: ProductListEntry | undefined;
			let addedQty: number | undefined;
			let updatedCartItemKey: string | undefined;

			// Shared helper: token-based cart item name matcher
			const buildCartMatcher = (hint: string) => {
				const tokens = normalizeText(hint).split(/\s+/);
				const ids = tokens.filter(t => /\d/.test(t));
				const words = tokens.filter(t => !/\d/.test(t) && t.length > 2);
				return (fullName: string): boolean => {
					const idMatch =
						ids.length === 0 || ids.every(t => fullName.includes(t));
					const wordMatch =
						words.length === 0 || words.some(t => fullName.includes(t));
					return (ids.length > 0 || words.length > 0) && idMatch && wordMatch;
				};
			};
			const cartFullName = (item: NonNullable<typeof session.cart>[0]) =>
				normalizeText(
					item.variantName
						? `${item.productName} ${item.variantName}`
						: item.productName,
				);

			// Mejor coincidencia por puntaje: elige el item del carrito cuyas palabras
			// del hint aparecen en mayor cantidad en el nombre — evita falsos positivos.
			const findBestCartItemByHint = (hint: string) => {
				const htokens = normalizeText(hint).split(/\s+/);
				const hids = htokens.filter(t => /\d/.test(t));
				const hwords = htokens.filter(t => !/\d/.test(t) && t.length > 2);
				if (!session.cart?.length || (hids.length === 0 && hwords.length === 0))
					return undefined;
				let best: NonNullable<typeof session.cart>[0] | undefined;
				let bestScore = 0;
				for (const item of session.cart) {
					const fullName = cartFullName(item);
					if (hids.length > 0 && !hids.every(t => fullName.includes(t)))
						continue;
					const score = hwords.filter(t => fullName.includes(t)).length;
					if (score > bestScore) {
						bestScore = score;
						best = item;
					}
				}
				return bestScore > 0 ? best : undefined;
			};

			// Detectar si el mensaje implica incremento de cantidad (reutilizable en PASO A y C)
			const isIncrement =
				/\b(agrega[r]?(?:s|as)?|agregu[ée][ns]?|a[nñ]ade[r]?(?:s|as)?|a[nñ]adi[ró]|sum[ae][r]?(?:s|as)?|sumemos)\b/i.test(
					normalizedText,
				) ||
				/\botr[ao]\b/i.test(normalizedText) ||
				/\d+\s*(?:kilo[s]?|kg|unidades?|u)?\.?\s+mas\b/i.test(normalizedText) ||
				/\bmas\s+de\b/i.test(normalizedText);

			// PASO A) Agregar/actualizar cantidad de producto en carrito (primero)
			// Se salta si hay cartEdits — PASO C maneja todo en ese caso.
			if (aiAddProductHint && !(aiCartEdits && aiCartEdits.length > 0)) {
				const normalizedHint = normalizeText(aiAddProductHint);
				const hintWords = normalizedHint
					.split(/\s+/)
					.filter(t => !/\d/.test(t) && t.length > 2);

				const requestedGrams = this.detectRequestedWeightGrams(normalizedText);

				// Buscar el item del carrito con mayor coincidencia semántica con el hint
				const cartItemToUpdate = findBestCartItemByHint(aiAddProductHint);
				console.log(
					`[WhatsApp Agent] edit_cart match: hint="${aiAddProductHint}", matched="${cartItemToUpdate?.productName ?? 'NONE'}${cartItemToUpdate?.variantName ? ` ${cartItemToUpdate.variantName}` : ''}", prevQty=${cartItemToUpdate?.quantity ?? 'N/A'}, isIncrement=${isIncrement}, aiQty=${aiQuantity}`,
				);

				if (cartItemToUpdate) {
					// Calcular unidades pedidas
					if (requestedGrams !== null && cartItemToUpdate.variantName) {
						const variantGrams = this.parseVariantWeightGrams(
							cartItemToUpdate.variantName,
						);
						if (variantGrams !== null) {
							addedQty = Math.ceil(requestedGrams / variantGrams);
						}
					}
					addedQty ??= aiQuantity ?? 1;

					const prevQty = cartItemToUpdate.quantity;
					cartItemToUpdate.quantity = isIncrement
						? prevQty + addedQty
						: addedQty;
					updatedCartItemKey =
						cartItemToUpdate.productVariantId ?? cartItemToUpdate.productId;
					console.log(
						`[WhatsApp Agent] Cart qty ${isIncrement ? 'increased' : 'set'}: ` +
							`${cartItemToUpdate.productName} x${cartItemToUpdate.quantity}`,
					);

					// Construir addedProductEntry para el reply
					addedProductEntry = session.lastProductList?.find(
						p => p.productId === cartItemToUpdate.productId,
					) ?? {
						productId: cartItemToUpdate.productId,
						name: cartItemToUpdate.productName,
						variants: cartItemToUpdate.productVariantId
							? [
									{
										variantId: cartItemToUpdate.productVariantId,
										stockItemId: cartItemToUpdate.stockItemId ?? null,
										name: cartItemToUpdate.variantName ?? '',
										totalQty: 0,
										price: cartItemToUpdate.unitPrice,
									},
								]
							: [],
					};
					// Para el reply usar la cantidad final del carrito
					addedQty = cartItemToUpdate.quantity;
				} else {
					// Producto no está en el carrito → buscarlo en lastProductList para agregarlo
					addedProductEntry =
						session.lastProductList?.find(
							p =>
								normalizeText(p.name).includes(normalizedHint) ||
								hintWords.some(t => normalizeText(p.name).includes(t)),
						) ?? undefined;

					if (addedProductEntry) {
						if (requestedGrams !== null) {
							const variantWeights = addedProductEntry.variants
								.map(v => ({
									variant: v,
									grams: this.parseVariantWeightGrams(v.name),
								}))
								.filter(
									(
										vw,
									): vw is {
										variant: ProductListEntry['variants'][0];
										grams: number;
									} => vw.grams !== null,
								);
							if (variantWeights.length > 0) {
								const largest = variantWeights.reduce((a, b) =>
									b.grams > a.grams ? b : a,
								);
								addedQty = Math.ceil(requestedGrams / largest.grams);
								session.selectedVariantName = largest.variant.name;
							}
						}
						addedQty ??= aiQuantity ?? 1;
						const resolvedVariant = session.selectedVariantName
							? addedProductEntry.variants.find(
									v => v.name === session.selectedVariantName,
								)
							: addedProductEntry.variants.length === 1
								? addedProductEntry.variants[0]
								: undefined;
						this.addToCart(
							session,
							addedProductEntry,
							addedQty,
							currency,
							resolvedVariant,
						);
					}
				}
			}

			// PASO B) Eliminar producto del carrito (segundo — omitir si mismo item fue actualizado en Paso A)
			if (aiRemoveProductHint && session.cart?.length) {
				const matchesRemove = buildCartMatcher(aiRemoveProductHint);
				const idx = session.cart.findIndex(item =>
					matchesRemove(cartFullName(item)),
				);
				if (idx !== -1) {
					const target = session.cart[idx];
					const targetKey = target.productVariantId ?? target.productId;
					if (targetKey === updatedCartItemKey) {
						// Mismo item → fue un cambio de cantidad, no una eliminación
						console.log(
							`[WhatsApp Agent] Cart remove skipped (qty update): ${target.productName}`,
						);
					} else {
						removedProductName = target.variantName
							? `${target.productName} ${target.variantName}`
							: target.productName;
						session.cart.splice(idx, 1);
						console.log(`[WhatsApp Agent] Cart remove: ${removedProductName}`);
					}
				}
			}

			// PASO C) Actualizar cantidad de productos del carrito vía cartEdits
			if (aiCartEdits && aiCartEdits.length > 0) {
				for (const edit of aiCartEdits) {
					const target = findBestCartItemByHint(edit.productHint);
					if (target) {
						const prevQty = target.quantity;
						target.quantity = isIncrement
							? prevQty + edit.quantity
							: edit.quantity;
						console.log(
							`[WhatsApp Agent] Cart edit: ${target.productName}${target.variantName ? ` ${target.variantName}` : ''} ${isIncrement ? `${prevQty}+${edit.quantity}` : `set`}=${target.quantity}`,
						);

						// Para el reply, usar el último producto editado
						addedProductEntry = session.lastProductList?.find(
							p => p.productId === target.productId,
						) ?? {
							productId: target.productId,
							name: target.productName,
							variants: target.productVariantId
								? [
										{
											variantId: target.productVariantId,
											stockItemId: target.stockItemId ?? null,
											name: target.variantName ?? '',
											totalQty: 0,
											price: target.unitPrice,
										},
									]
								: [],
						};
						addedQty = target.quantity;
					}
				}
				// Con múltiples edits (2+), limpiar para que reply reciba carrito completo
				if (aiCartEdits.length > 1) {
					addedProductEntry = undefined;
					addedQty = undefined;
				}
			}

			replyText = await this.openai
				.generateReply({
					userMessage: text,
					intent: 'edit_cart',
					cart: session.cart,
					currency,
					removedProduct: removedProductName,
					addedProduct: addedProductEntry
						? {
								name: addedProductEntry.name,
								variants: addedProductEntry.variants,
							}
						: undefined,
					addedQuantity: addedQty,
				})
				.then(reply => {
					console.log(
						`[WhatsApp Agent] edit_cart final: addedQty=${addedQty}, product=${addedProductEntry?.name ?? 'NONE'}, reply=${reply.substring(0, 80)}`,
					);
					return reply;
				})
				.catch(() => 'Listo, actualicé tu pedido. ¿Necesitas algo más?');
		} else if (intent === 'show_cart') {
			const currency =
				session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
			replyText = await this.openai
				.generateReply({
					userMessage: text,
					intent: 'show_cart',
					cart: session.cart,
					currency,
				})
				.catch(() => 'No tienes productos en tu pedido todavía.');
		} else if (intent === 'request_quote') {
			if (!session.cart || session.cart.length === 0) {
				replyText =
					'Todavía no tienes productos en tu pedido. Primero agrega lo que necesites y luego te armo la cotización.';
			} else {
				// Buscar si ya existe un cliente con este teléfono
				const isoCode =
					session.lastCountryInfo?.isoCode ?? countryInfo?.isoCode ?? 'CO';
				// Strip country calling code — phoneNumber in DB is stored without it
				const localPhone = this.stripCallingCode(phoneNumber);
				const existingCustomer = await this.customerService.findByPhone(
					localPhone,
					isoCode,
				);
				if (existingCustomer) {
					// Cliente ya existe: ir directo a confirmación
					session.pendingQuoteFlow = {
						step: 'awaiting_confirmation',
						collectedData: {
							fullName: existingCustomer.fullName,
							dni: existingCustomer.dni,
							phoneNumber: localPhone,
							location: existingCustomer.location,
							cityId: existingCustomer.cityId,
							cityName: existingCustomer.cityName
								? `${existingCustomer.cityName}${existingCustomer.regionName ? `, ${existingCustomer.regionName}` : ''}`
								: undefined,
							customerId: existingCustomer.id,
							personId: existingCustomer.personId,
						},
					};
					const currency =
						session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
					replyText = await this.openai
						.generateReply({
							userMessage: text,
							intent: 'existing_customer_confirmation',
							cart: session.cart,
							currency,
							quoteFlowData: session.pendingQuoteFlow.collectedData,
						})
						.catch(
							() =>
								`¡Hola de nuevo, ${existingCustomer.fullName}! Ya tengo tus datos registrados. ¿Procedemos con la cotización?`,
						);
				} else {
					// Cliente nuevo: iniciar flujo de recopilación
					session.pendingQuoteFlow = {
						step: 'awaiting_customer_data',
						collectedData: { phoneNumber: localPhone },
					};
					replyText = await this.openai
						.generateReply({
							userMessage: text,
							intent: 'request_quote',
						})
						.catch(
							() =>
								'¡Claro! Para armarte la cotización necesito tu nombre completo y tu número de cédula.',
						);
				}
				await redis.set(
					`session:${phoneNumber}`,
					JSON.stringify(session),
					'EX',
					SESSION_TTL_SECONDS,
				);
			}
		} else {
			replyText = await this.openai
				.generateReply({ userMessage: text, isFirstInteraction })
				.catch(() => 'Hola, soy Gema 👋 ¿En qué te puedo ayudar?');
		}

		// Guardar último mensaje del bot en la sesión para contexto en próximas respuestas
		session.lastBotMessage = replyText;
		await redis.set(
			`session:${phoneNumber}`,
			JSON.stringify(session),
			'EX',
			SESSION_TTL_SECONDS,
		);

		await new Promise(resolve => setTimeout(resolve, REPLY_DELAY_MS));
		await this.sendReply(phoneNumber, botPhoneNumberId, replyText);

		this.logService
			.logMessage({
				phoneNumber,
				botPhoneNumberId,
				direction: 'outbound',
				text: replyText,
				intent: null,
				countryPrefix,
			})
			.catch(err => {
				console.error(
					'[WhatsApp Agent] Error saving outbound message log:',
					err,
				);
				this.logService
					.logError({ context: 'logMessage:outbound', error: err, phoneNumber })
					.catch(e =>
						console.error('[WhatsApp Agent] Failed to save error log:', e),
					);
			});
	};

	/** Strip country calling code prefix from WhatsApp E.164 phone number */
	private stripCallingCode = (phoneNumber: string): string => {
		const prefixes = ['593', '57']; // longest first
		const matched = prefixes.find(p => phoneNumber.startsWith(p));
		return matched ? phoneNumber.slice(matched.length) : phoneNumber;
	};

	private detectCountryFromPhone = async (
		phoneNumber: string,
	): Promise<{
		currency: string;
		stockIds: string[];
		shopId: string;
		isoCode: string;
	} | null> => {
		try {
			// Detectar callingCode desde el número (formato E.164 sin +)
			const prefixes = ['593', '57']; // Ecuador primero (más largo)
			const matchedPrefix = prefixes.find(p => phoneNumber.startsWith(p));
			if (!matchedPrefix) {
				console.warn(
					`[WhatsApp Agent] Unknown country prefix for ${phoneNumber}`,
				);
				return null;
			}

			// Resolver shop por país usando slug (misma convención que customer-balance)
			const shopSlug =
				matchedPrefix === '57' ? 'manuarte-barranquilla' : 'manuarte-quito';

			const shop = await ShopModel.findOne({
				where: { slug: shopSlug },
				attributes: ['id', 'currency'],
				include: [
					{
						model: StockModel,
						as: 'stock',
						attributes: ['id'],
					},
					{
						model: CountryModel,
						as: 'country',
						attributes: ['isoCode'],
					},
				],
			});

			if (!shop) return null;

			const stock = shop.get('stock') as { id: string } | null;
			const country = shop.get('country') as { isoCode: string } | null;
			const stockIds = stock ? [stock.id] : [];
			const currency = (shop.get('currency') as string | undefined) ?? 'USD';
			const isoCode =
				country?.isoCode ?? (matchedPrefix === '57' ? 'CO' : 'EC');

			console.log(
				`[WhatsApp Agent] Country detected: +${matchedPrefix}, currency: ${currency}, shop: ${shopSlug}, stocks: ${stockIds.join(', ')}`,
			);
			return { currency, stockIds, shopId: shop.id, isoCode };
		} catch (error) {
			console.error('[WhatsApp Agent] Error detecting country:', error);
			this.logService
				.logError({ context: 'detectCountryFromPhone', error, phoneNumber })
				.catch(e =>
					console.error('[WhatsApp Agent] Failed to save error log:', e),
				);
			return null;
		}
	};

	/**
	 * Returns an intent only for cases the backend can resolve deterministically
	 * (show_more, affirmation, show_cart). Returns null when uncertain
	 * so the AI can take over.
	 */
	private detectDeterministicIntent = (
		normalizedText: string,
	): string | null => {
		const showMorePhrases = [
			'ver mas',
			'mas opciones',
			'quiero ver mas',
			'muestrame mas',
			'muestra mas',
			'hay mas',
			'tienes mas',
			'tienen mas',
			'no tienen mas',
			'no tienes mas',
			'no hay mas',
			'mostrar mas',
			'ver otras',
			'ver otros',
			'otras opciones',
			'otras alternativas',
			'alguna otra',
			'alguna mas',
			'algun otro',
			'tienen otra',
			'tienen otro',
			'tienen alguna',
			'tienes otra',
			'tienes otro',
			'mas productos',
			'ver mas opciones',
			'quiero ver otras',
			'quiero mas',
			'ver siguiente',
			'ver siguientes',
			'nada mas',
			'no tienen nada mas',
			'no tienes nada mas',
		];
		const showMoreExact = /^(mas|otros|otras|siguiente|siguientes)[,!.\s?]*$/i;
		// Si el mensaje dice "tienes más X" o "más opciones de X" con un sustantivo
		// tras el modificador, es una búsqueda nueva. Ej: "tienes más mechas"
		const showMoreWithProductRegex =
			/(?:tienes\s+mas|tienen\s+mas|hay\s+mas|mas\s+opciones\s+de|mas\s+tipos\s+de)\s+\w/i;
		if (
			!showMoreWithProductRegex.test(normalizedText) &&
			(showMorePhrases.some(p => normalizedText.includes(p)) ||
				showMoreExact.test(normalizedText.trim()))
		)
			return 'show_more';

		// Afirmación con cantidad explícita: "Sí, dame 5", "si quiero 3", "ok ponme 2"
		const affirmationWithQtyRegex =
			/^(si|vale|ok|dale|claro|listo|perfecto|bueno|de acuerdo|va|venga|obvio)[,\s!.]+(?:(?:dame|quiero|ponme|pon|agrega|necesito|llevo|llevame|mandame|enviame)\s+)?\d+\b/i;
		if (affirmationWithQtyRegex.test(normalizedText.trim()))
			return 'affirmation';

		const isAffirmationOnly =
			/^(si|vale|ok|dale|claro|listo|perfecto|bueno|de acuerdo|va|venga|obvio)[,!.\s?]*$/i.test(
				normalizedText.trim(),
			);
		if (isAffirmationOnly) return 'affirmation';

		const showCartPhrases = [
			'que llevamos',
			'que llevo',
			'mi carrito',
			'ver carrito',
			'ver pedido',
			'mi pedido',
			'lo que llevo',
			'lo que llevamos',
			'lo que tengo',
			'resumen del pedido',
			'mostrame el pedido',
			'muestrame el pedido',
			'muestrame que llevamos',
			'muestrame que llevo',
			'que hay en el carrito',
			'que tengo en el carrito',
			'cuanto seria el total',
			'cuanto seria por todo',
			'cuanto es el total',
			'cuanto es por todo',
			'cuanto va el total',
			'cuanto va todo',
			'cuanto es todo',
			'cuanto seria todo',
			'cuanto suma todo',
			'cuanto me sale todo',
			'cuanto me saldria todo',
			'cuanto seria en total',
			'a cuanto sube todo',
			'a cuanto llega todo',
			'a cuanto llega el total',
		];
		if (showCartPhrases.some(p => normalizedText.includes(p)))
			return 'show_cart';

		const requestQuotePhrases = [
			'cotizacion',
			'cotización',
			'cotizar',
			'cotizame',
			'cotizalo',
			'cotizalos',
			'presupuesto',
			'proforma',
			'hazme una cotizacion',
			'genera la cotizacion',
			'arma la cotizacion',
			'quiero cotizar',
			'quiero la cotizacion',
			'me generas la cotizacion',
			'enviame la cotizacion',
		];
		if (requestQuotePhrases.some(p => normalizedText.includes(p)))
			return 'request_quote';

		return null;
	};

	private detectIntent = (normalizedText: string): string => {
		const objectionPhrases = [
			'muy caro',
			'esta caro',
			'es caro',
			'caro',
			'no me alcanza',
			'no tengo',
			'sin dinero',
			'sin plata',
			'no tengo plata',
			'no tengo dinero',
			'lo pienso',
			'lo voy a pensar',
			'voy a pensar',
			'pensarlo',
			'despues',
			'luego',
			'mas adelante',
			'otro dia',
			'ahorita no',
			'por ahora no',
			'no por ahora',
			'lo consulto',
			'te aviso',
			'no me interesa',
			'ya no',
			'dejalo',
			'dejame pensar',
		];

		const hasObjection = objectionPhrases.some(phrase =>
			normalizedText.includes(phrase),
		);
		if (hasObjection) return 'objection';

		const showMorePhrases = [
			'ver mas',
			'mas opciones',
			'quiero ver mas',
			'muestrame mas',
			'muestra mas',
			'hay mas',
			'tienes mas',
			'mostrar mas',
			'ver otras',
			'ver otros',
			'otras opciones',
			'otras alternativas',
			'mas productos',
			'ver mas opciones',
			'quiero ver otras',
			'quiero mas',
			'ver siguiente',
			'ver siguientes',
		];
		const showMoreExact = /^(mas|otros|otras|siguiente|siguientes)[,!.\s?]*$/i;
		if (
			showMorePhrases.some(p => normalizedText.includes(p)) ||
			showMoreExact.test(normalizedText.trim())
		)
			return 'show_more';

		const isAffirmationOnly =
			/^(si|vale|ok|dale|claro|listo|perfecto|bueno|de acuerdo|va|venga|obvio)[,!.\s?]*$/i.test(
				normalizedText.trim(),
			);
		if (isAffirmationOnly) return 'affirmation';

		const productKeywords = [
			'producto',
			'precio',
			'tienes',
			'tienen',
			'hay',
			'busco',
			'buscando',
			'buscar',
			'buscas',
			'quiero',
			'necesito',
			'cuesta',
			'vale',
			'disponible',
			'stock',
			'venden',
			'vende',
			'interesa',
			'vendes',
		];
		const hasProductKeyword = productKeywords.some(kw =>
			normalizedText.includes(kw),
		);
		if (hasProductKeyword) return 'search_product';

		const words = normalizedText.split(' ');
		const knownProductTerms = new Set(Object.keys(SYNONYMS));
		const hasKnownProductTerm = words.some(
			w => knownProductTerms.has(w) || knownProductTerms.has(stemTerm(w)),
		);
		if (hasKnownProductTerm) return 'search_product';

		const pureGreetingOrAckWords = new Set([
			'hola',
			'ola',
			'hey',
			'buenos',
			'buenas',
			'buen',
			'dias',
			'tardes',
			'noches',
			'madrugada',
			'como',
			'estas',
			'esta',
			'tal',
			'bien',
			'todo',
			'gracias',
			'ok',
			'perfecto',
			'genial',
			'entendido',
			'listo',
			'claro',
			'dale',
			'excelente',
			'super',
			'vale',
			'si',
			'bueno',
			'venga',
		]);
		const substantiveWords = words.filter(
			w => w.length > 2 && !pureGreetingOrAckWords.has(w),
		);
		if (substantiveWords.length > 0) return 'search_product';

		return 'greeting';
	};

	private detectSelectionByName = (
		normalizedText: string,
		productList: ProductListEntry[],
	): number | null => {
		const stopWords = new Set([
			'el',
			'la',
			'los',
			'las',
			'un',
			'una',
			'de',
			'del',
			'al',
			'en',
			'con',
			'por',
			'para',
			'me',
			'que',
			'se',
			'mi',
			'tu',
			'su',
			'ese',
			'esa',
			'eso',
			'esta',
			'este',
			'y',
			'o',
			'a',
		]);

		const msgWords = normalizedText
			.split(/\s+/)
			.filter(w => w.length > 2 && !stopWords.has(w));

		if (msgWords.length === 0) return null;

		let bestIndex: number | null = null;
		let bestScore = 0;
		let bestRatio = 0;

		productList.forEach((product, i) => {
			const productNorm = normalizeText(product.name);
			const variantNorm = product.variants
				.map(v => normalizeText(v.name ?? ''))
				.join(' ');
			const combined = `${productNorm} ${variantNorm}`;
			const productWords = combined
				.split(/\s+/)
				.filter(w => w.length > 2 && !stopWords.has(w));

			const score = msgWords.filter(w => productWords.includes(w)).length;
			// Usar ratio matched/total para preferir el producto más específico cuando hay empate.
			// Ej: "karite" coincide con "KARITE" (1/6=0.167) y con "AVENA & KARITE" (1/7=0.143),
			// ganando el primero por tener menos palabras extra.
			const ratio =
				score > 0 && productWords.length > 0 ? score / productWords.length : 0;
			if (ratio > bestRatio || (ratio === bestRatio && score > bestScore)) {
				bestRatio = ratio;
				bestScore = score;
				bestIndex = i + 1;
			}
		});

		return bestScore >= 1 ? bestIndex : null;
	};

	private detectSelection = (normalizedText: string): number | null => {
		// "2", "el 2", "la 2", "el número 2", "número 2"
		const numMatch = normalizedText.match(
			/^(?:(?:el|la)\s+)?(?:numero\s+)?(\d+)$/,
		);
		if (numMatch) return parseInt(numMatch[1], 10);

		// "me interesa la 2", "quiero el 3", "dame la 2 por favor"
		const contextNumMatch = normalizedText.match(
			/(?:el|la)\s+(?:numero\s+)?(\d+)(?:\s|$)/,
		);
		if (contextNumMatch) return parseInt(contextNumMatch[1], 10);

		// Ordinales en español
		const ordinals: Record<string, number> = {
			primero: 1,
			primera: 1,
			segundo: 2,
			segunda: 2,
			tercero: 3,
			tercera: 3,
			cuarto: 4,
			cuarta: 4,
			quinto: 5,
			quinta: 5,
		};
		const clean = normalizedText.replace(/^(el|la)\s+/, '').trim();
		return ordinals[clean] ?? null;
	};

	private buildSelectionReply = (
		product: ProductListEntry,
		currency: string,
	): string => {
		if (product.variants.length === 1) {
			const v = product.variants[0];
			const priceText = formatPrice(v.price, currency);
			const detail = v.name ? `${v.name} – ${priceText}` : priceText;
			return (
				`Perfecto 👌\n\n*${product.name}*\n${detail} · ${v.totalQty} disponibles` +
				'\n\n¿Te ayudo con la cotización o tienes alguna duda?'
			);
		}

		const variantLines = product.variants.map(v => {
			const priceText = formatPrice(v.price, currency);
			return `  - ${v.name} – ${priceText} (${v.totalQty} disponibles)`;
		});

		return (
			`Perfecto 👌\n\n*${product.name}* lo tenemos en estas presentaciones:\n\n` +
			variantLines.join('\n') +
			'\n\n¿Con cuál te quedas?'
		);
	};

	private buildResumptionReply = (product: ProductListEntry): string => {
		const variantLines = product.variants.map(v => `• ${v.name}`).join('\n');
		return (
			`Hola 😊 retomamos donde lo dejamos.\n\nEstábamos viendo:\n\n*${product.name}*` +
			(product.description ? `\n_${product.description}_` : '') +
			(product.variants.length > 1 ? `\n${variantLines}` : '') +
			`\n\n¿Quieres continuar con ese o buscas algo diferente?`
		);
	};

	private resolveVariant = (
		product: ProductListEntry,
		hint?: string,
		userText?: string,
	): ProductListEntry['variants'][0] | undefined => {
		if (product.variants.length === 1) return product.variants[0];

		// 1) Hint-based match (existing logic)
		if (hint) {
			const normalizedHint = normalizeText(hint);
			const match =
				product.variants.find(v =>
					normalizeText(v.name).includes(normalizedHint),
				) ??
				product.variants.find(v =>
					normalizedHint.includes(normalizeText(v.name)),
				);
			if (match) return match;
		}

		// 2) User text keyword match: score each variant by how many of its
		//    distinctive words appear in the message
		if (userText) {
			const normalized = normalizeText(userText);
			let bestVariant: ProductListEntry['variants'][0] | undefined;
			let bestScore = 0;
			for (const v of product.variants) {
				const vWords = normalizeText(v.name)
					.split(/\s+/)
					.filter(w => w.length > 1);
				const score = vWords.filter(w => normalized.includes(w)).length;
				if (score > bestScore) {
					bestScore = score;
					bestVariant = v;
				}
			}
			if (bestVariant && bestScore > 0) return bestVariant;
		}

		// 3) Fallback: pick variant with highest stock (most popular)
		return product.variants.reduce((best, v) =>
			v.totalQty > best.totalQty ? v : best,
		);
	};

	/**
	 * Convierte el nombre de una variante a gramos cuando es posible.
	 * Ej: "100g" → 100, "Medio Kilo" → 500, "KILO" → 1000, "(APROX. 20 unidades)" → null
	 */
	private parseVariantWeightGrams = (variantName: string): number | null => {
		const normalized = variantName.toLowerCase().trim();
		// "Medio Kilo" → 500g
		if (/\bmedio\s*kilo\b/.test(normalized)) return 500;
		// "1 kilo", "2 kilos", "1kg" → gramos
		const kiloMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:kilo[s]?|kg)/);
		if (kiloMatch) return parseFloat(kiloMatch[1].replace(',', '.')) * 1000;
		// "kilo" o "kilos" sin número → 1000g
		if (/^\s*kilo[s]?\s*$/.test(normalized)) return 1000;
		// "100g", "250gr", "500 gramos" → gramos directos
		const gramMatch = normalized.match(
			/(\d+(?:[.,]\d+)?)\s*(?:gr(?:amo[s]?)?|g\b)/,
		);
		if (gramMatch) return parseFloat(gramMatch[1].replace(',', '.'));
		return null;
	};

	/**
	 * Detecta si el texto del cliente especifica una cantidad por peso.
	 * Devuelve el peso en gramos, o null si no hay unidad de peso reconocible.
	 */
	private detectRequestedWeightGrams = (text: string): number | null => {
		const weightMatch = text.match(
			/\b(\d+(?:[.,]\d+)?)\s*(kilo[s]?|kg|gramo[s]?|gr|g)\b/i,
		);
		if (!weightMatch) return null;
		const val = parseFloat(weightMatch[1].replace(',', '.'));
		const unit = weightMatch[2].toLowerCase();
		return unit.startsWith('k') ? val * 1000 : val;
	};

	/**
	 * Dado un peso en gramos y las variantes de un producto, devuelve la variante
	 * más adecuada y la cantidad de unidades necesarias.
	 *
	 * Lógica:
	 * 1. Preferir variantes donde `requestedGrams` sea múltiplo exacto de la variante.
	 *    (ej: 4000g → KILO 1000g = exacto ✓, CAJA 10 KILOS 10000g = no exacto ✗)
	 * 2. Entre candidatos exactos (o todos si no hay exactos), preferir la que da
	 *    MENOS unidades (más eficiente para el cliente).
	 *    (ej: 10 kilos → KILO 10u vs CAJA 10 KILOS 1u → CAJA gana)
	 */
	private resolveVariantByWeight = (
		variants: ProductListEntry['variants'],
		requestedGrams: number,
	): { variant: ProductListEntry['variants'][0]; units: number } | null => {
		const weighted = variants
			.map(v => ({ variant: v, grams: this.parseVariantWeightGrams(v.name) }))
			.filter(
				(
					vw,
				): vw is { variant: ProductListEntry['variants'][0]; grams: number } =>
					vw.grams !== null && vw.grams > 0,
			);
		if (weighted.length === 0) return null;

		const exactMatches = weighted.filter(vw => requestedGrams % vw.grams === 0);
		const candidates = exactMatches.length > 0 ? exactMatches : weighted;

		// Menor cantidad de unidades = presentación más práctica para la cantidad pedida
		const best = candidates.reduce((a, b) => {
			const unitsA = Math.ceil(requestedGrams / a.grams);
			const unitsB = Math.ceil(requestedGrams / b.grams);
			return unitsB < unitsA ? b : a;
		});

		return {
			variant: best.variant,
			units: Math.ceil(requestedGrams / best.grams),
		};
	};

	private addToCart = (
		session: UserSession,
		product: ProductListEntry,
		quantity: number,
		currency: string,
		variantOverride?: ProductListEntry['variants'][0],
	): void => {
		if (!session.cart) session.cart = [];
		const variant =
			variantOverride ??
			(product.variants.length === 1 ? product.variants[0] : undefined);
		// No agregar al carrito si el producto tiene múltiples variantes y ninguna está resuelta
		if (!variant && product.variants.length > 1) {
			console.log(
				`[WhatsApp Agent] Cart add skipped for ${product.name}: ${product.variants.length} variants and none resolved.`,
			);
			return;
		}
		const existing = session.cart.find(i =>
			variant
				? i.productVariantId === variant.variantId
				: i.productId === product.productId,
		);
		if (existing) {
			existing.quantity = quantity;
			if (variant) {
				existing.variantName = variant.name;
				existing.unitPrice = variant.price;
				existing.productVariantId = variant.variantId;
				existing.stockItemId = variant.stockItemId;
			}
		} else {
			session.cart.push({
				productId: product.productId,
				productVariantId: variant?.variantId,
				stockItemId: variant?.stockItemId,
				productName: product.name,
				variantName: variant?.name,
				quantity,
				unitPrice: variant?.price ?? null,
				currency,
			});
		}
		console.log(
			`[WhatsApp Agent] Cart updated: ${product.name}${variant ? ` – ${variant.name}` : ''} x${quantity}. Cart size: ${session.cart.length}`,
		);
	};

	/**
	 * Maneja cada paso del flujo de cotización. Retorna el texto de respuesta
	 * si el paso fue procesado, o null si se debe continuar con el flujo normal.
	 */
	private handleQuoteFlowStep = async (
		phoneNumber: string,
		botPhoneNumberId: string,
		text: string,
		normalizedText: string,
		session: UserSession,
		countryInfo: {
			currency: string;
			stockIds: string[];
			shopId: string;
			isoCode: string;
		} | null,
	): Promise<string | null> => {
		const flow = session.pendingQuoteFlow!;
		const currency =
			session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';

		// Permitir cancelar el flujo
		if (
			/\b(cancelar|cancelalo|no\s*quiero|dejalo|olvidalo)\b/i.test(
				normalizedText,
			)
		) {
			session.pendingQuoteFlow = null;
			return 'Listo, cancelé el proceso de cotización. ¿Necesitas algo más?';
		}

		if (flow.step === 'awaiting_customer_data') {
			const extracted = await this.openai.extractCustomerData(
				text,
				'customer_data',
			);
			const fullName = extracted.fullName ?? flow.collectedData?.fullName;
			const dni = extracted.dni ?? flow.collectedData?.dni;

			if (!fullName || !dni) {
				flow.collectedData = { ...flow.collectedData, fullName, dni };
				const missing =
					!fullName && !dni
						? 'tu nombre completo y tu número de cédula'
						: !fullName
							? 'tu nombre completo'
							: 'tu número de cédula';
				return await this.openai
					.generateReply({
						userMessage: text,
						intent: 'awaiting_customer_data',
					})
					.catch(() => `Me falta ${missing}. ¿Me lo compartes?`);
			}

			flow.collectedData = { ...flow.collectedData, fullName, dni };
			flow.step = 'awaiting_address';

			return await this.openai
				.generateReply({
					userMessage: text,
					intent: 'awaiting_address',
				})
				.catch(
					() =>
						'Perfecto. Ahora necesito tu dirección de entrega y la ciudad, por favor.',
				);
		}

		if (flow.step === 'awaiting_address') {
			const extracted = await this.openai.extractCustomerData(text, 'address');
			const location = extracted.location ?? flow.collectedData?.location;
			const cityText = extracted.city;

			if (!location) {
				return await this.openai
					.generateReply({
						userMessage: text,
						intent: 'awaiting_address',
					})
					.catch(
						() =>
							'Necesito tu dirección de entrega para continuar. ¿Me la compartes?',
					);
			}

			flow.collectedData = { ...flow.collectedData, location };

			if (!cityText) {
				return '¿Y en qué ciudad estás?';
			}

			// Buscar la ciudad
			const cityResult = await this.cityService.search(cityText);
			const cityResults = cityResult?.cities ?? [];
			if (cityResults.length === 0) {
				return `No encontré la ciudad "${cityText}". ¿Puedes escribirla de nuevo?`;
			}

			if (cityResults.length === 1) {
				const city = cityResults[0].dataValues;
				flow.collectedData.cityId = city.id;
				flow.collectedData.cityName = `${city.name}, ${city.regionName}`;
				flow.step = 'awaiting_confirmation';

				return await this.openai
					.generateReply({
						userMessage: text,
						intent: 'awaiting_confirmation',
						cart: session.cart,
						currency,
						quoteFlowData: flow.collectedData,
					})
					.catch(() => '¿Confirmo la cotización con estos datos?');
			}

			// Múltiples coincidencias
			flow.cityCandidates = cityResults.slice(0, 5).map(c => {
				const d = c.dataValues;
				return {
					id: d.id,
					name: d.name,
					regionName: d.regionName,
				};
			});
			flow.step = 'awaiting_city_selection';

			return await this.openai
				.generateReply({
					userMessage: text,
					intent: 'awaiting_city_selection',
					cityCandidates: flow.cityCandidates.map((c, i) => ({
						index: i + 1,
						name: c.name,
						region: c.regionName,
					})),
				})
				.catch(() => {
					const list = flow
						.cityCandidates!.map(
							(c, i) => `${i + 1}. ${c.name}, ${c.regionName}`,
						)
						.join('\n');
					return `Encontré varias opciones:\n${list}\n¿Cuál es la tuya?`;
				});
		}

		if (flow.step === 'awaiting_city_selection') {
			const candidates = flow.cityCandidates ?? [];
			// Intentar por número
			const selectionMatch = normalizedText.match(/^(\d+)$/);
			const selectedIdx = selectionMatch
				? parseInt(selectionMatch[1], 10) - 1
				: -1;

			if (selectedIdx >= 0 && selectedIdx < candidates.length) {
				const selected = candidates[selectedIdx];
				flow.collectedData = {
					...flow.collectedData,
					cityId: selected.id,
					cityName: `${selected.name}, ${selected.regionName}`,
				};
				flow.cityCandidates = undefined;
				flow.step = 'awaiting_confirmation';

				return await this.openai
					.generateReply({
						userMessage: text,
						intent: 'awaiting_confirmation',
						cart: session.cart,
						currency,
						quoteFlowData: flow.collectedData,
					})
					.catch(() => '¿Confirmo la cotización con estos datos?');
			}

			// Intentar por nombre
			const nameMatch = candidates.find(
				c =>
					normalizeText(c.name).includes(normalizedText) ||
					normalizedText.includes(normalizeText(c.name)),
			);
			if (nameMatch) {
				flow.collectedData = {
					...flow.collectedData,
					cityId: nameMatch.id,
					cityName: `${nameMatch.name}, ${nameMatch.regionName}`,
				};
				flow.cityCandidates = undefined;
				flow.step = 'awaiting_confirmation';

				return await this.openai
					.generateReply({
						userMessage: text,
						intent: 'awaiting_confirmation',
						cart: session.cart,
						currency,
						quoteFlowData: flow.collectedData,
					})
					.catch(() => '¿Confirmo la cotización con estos datos?');
			}

			// No se pudo identificar
			const list = candidates
				.map((c, i) => `${i + 1}. ${c.name}, ${c.regionName}`)
				.join('\n');
			return `No entendí tu selección. Elige el número:\n${list}`;
		}

		if (flow.step === 'awaiting_confirmation') {
			// Detectar confirmación: comienza con palabra afirmativa Y no contiene intención de corrección
			const startsAffirmative =
				/^(si|sí|vale|ok|dale|claro|listo|perfecto|bueno|confirmo|de acuerdo|va|venga|correcto|todo bien|esta bien|nada)\b/i.test(
					normalizedText.trim(),
				);
			const hasCorrection =
				/\b(cambiar|cambio|cambia|corregir|corrige|modificar|modifica|pero|mal|error|falta|no es|en vez de|en lugar de|la cedula|el nombre|la direccion|el telefono|el numero)\b/i.test(
					normalizedText,
				);
			// Also detect when message contains a raw number that looks like a DNI correction
			const looksLikeDniCorrection =
				!startsAffirmative && /\b\d{6,12}\b/.test(normalizedText);
			const isConfirm =
				startsAffirmative && !hasCorrection && !looksLikeDniCorrection;

			if (!isConfirm) {
				// Use AI to detect what the customer wants to correct
				const correctionResult = await this.openai.extractQuoteCorrection(
					text,
					flow.collectedData ?? {},
				);

				let dataChanged = false;

				// Apply corrections detected by AI
				if (correctionResult.fullName) {
					flow.collectedData = {
						...flow.collectedData,
						fullName: correctionResult.fullName,
					};
					dataChanged = true;
				}
				if (correctionResult.dni) {
					flow.collectedData = {
						...flow.collectedData,
						dni: correctionResult.dni,
					};
					dataChanged = true;
				}
				if (correctionResult.phoneNumber) {
					flow.collectedData = {
						...flow.collectedData,
						phoneNumber: correctionResult.phoneNumber,
					};
					dataChanged = true;
				}
				if (correctionResult.location) {
					flow.collectedData = {
						...flow.collectedData,
						location: correctionResult.location,
					};
					dataChanged = true;
				}
				if (correctionResult.city) {
					const cityText = correctionResult.city;
					const cityResult = await this.cityService.search(cityText);
					const cityResults = cityResult?.cities ?? [];
					if (cityResults.length === 1) {
						const city = cityResults[0].dataValues;
						flow.collectedData = {
							...flow.collectedData,
							cityId: city.id,
							cityName: `${city.name}, ${city.regionName}`,
						};
						dataChanged = true;
					} else if (cityResults.length > 1) {
						flow.cityCandidates = cityResults.slice(0, 5).map(c => {
							const d = c.dataValues;
							return { id: d.id, name: d.name, regionName: d.regionName };
						});
						flow.step = 'awaiting_city_selection';
						const list = flow.cityCandidates
							.map((c, i) => `${i + 1}. ${c.name}, ${c.regionName}`)
							.join('\n');
						return `Encontré varias opciones para "${cityText}":\n${list}\n¿Cuál es?`;
					}
				}

				if (dataChanged) {
					return await this.openai
						.generateReply({
							userMessage: text,
							intent: 'awaiting_confirmation',
							cart: session.cart,
							currency,
							quoteFlowData: flow.collectedData,
						})
						.catch(
							() => '¿Confirmo la cotización con estos datos actualizados?',
						);
				}

				// AI could not detect what to correct — ask for clarification
				return await this.openai
					.generateReply({
						userMessage: text,
						intent: 'awaiting_correction_unclear',
						quoteFlowData: flow.collectedData,
					})
					.catch(
						() =>
							'¿Qué dato necesitas corregir? Puedes decirme el nombre, cédula, dirección o ciudad.',
					);
			}

			// Generar la cotización
			try {
				const data = flow.collectedData!;
				const shopId =
					session.lastCountryInfo?.shopId ?? countryInfo?.shopId ?? '';
				const items = this.mapCartToQuoteItems(session.cart ?? []);

				if (items.length === 0) {
					session.pendingQuoteFlow = null;
					return 'No hay productos válidos en tu pedido para generar la cotización.';
				}

				// Si no tenemos customerId, buscar persona existente por DNI
				// para evitar SequelizeUniqueConstraintError en person.dni
				if (!data.customerId && data.dni) {
					const existingPerson = await PersonModel.findOne({
						where: { dni: data.dni },
						attributes: ['id'],
					});
					if (existingPerson) {
						data.personId = existingPerson.id;
						const existingCustomer = await CustomerModel.findOne({
							where: { personId: existingPerson.id },
							attributes: ['id'],
						});
						if (existingCustomer) {
							data.customerId = existingCustomer.id;
						}
					}
				}

				// Quitar código de país del teléfono (ej: 573127600792 → 3127600792)
				const rawPhone = data.phoneNumber ?? phoneNumber;
				const localPhone = rawPhone.replace(/^(57|593)/, '');

				const result = await this.quoteService.create({
					quoteData: {
						shopId,
						items,
						status: QuoteStatus.PENDING,
						discountType: 'FIXED',
						discount: 0,
						shipping: 0,
						requestedBy: ENV.WHATSAPP_BOT_USER_ID,
						currency: currency as 'COP' | 'USD',
					},
					customerData: {
						fullName: data.fullName ?? '',
						dni: data.dni ?? '',
						email: '',
						phoneNumber: localPhone,
						location: data.location ?? '',
						cityId: String(data.cityId ?? ''),
						customerId: data.customerId,
						personId: data.personId,
					},
				});

				// Limpiar flujo y carrito
				session.pendingQuoteFlow = null;
				session.cart = [];
				session.selectedProduct = undefined;

				const serial = result.newQuote.serialNumber;

				// Enviar PDF por WhatsApp (fire-and-forget, no bloquea el reply)
				this.docsService
					.generateQuote(serial)
					.then(async (buffer: Buffer) => {
						const filename = `CTZ-${serial}.pdf`;
						const quoteResult = await this.quoteService.getOne(serial);
						if (quoteResult.status !== 200) return;

						const quote = quoteResult.quote;
						const mediaId = await this.whatsAppService.uploadMedia(
							buffer,
							filename,
							botPhoneNumberId,
						);
						const { total } = calculateTotals(quote);
						const recipientPhone = `${quote.callingCode}${quote.phoneNumber}`;

						const formattedTotal = formatCurrency(total);
						const caption = `📄 Cotización #${serial} por un total de ${formattedTotal}.\n\n`;

						await Promise.all([
							this.whatsAppService.sendDocument(
								recipientPhone,
								mediaId,
								botPhoneNumberId,
								filename,
								caption,
							),
						]);
					})
					.catch(err =>
						console.error(
							`[WhatsApp Agent] Error sending quote PDF for ${serial}:`,
							err,
						),
					);

				return 'Con gusto te ayudo a completar la compra 😊';
			} catch (error) {
				console.error('[WhatsApp Agent] Error creating quote:', error);
				session.pendingQuoteFlow = null;
				return 'Hubo un problema generando la cotización. Por favor intenta de nuevo o contacta a nuestro equipo.';
			}
		}

		return null;
	};

	private mapCartToQuoteItems = (
		cart: CartItem[],
	): Array<{
		productVariantId: string;
		stockItemId?: string;
		quoteId: string;
		name: string;
		quantity: number;
		price: number;
		currency: 'COP' | 'USD';
	}> => {
		return cart
			.filter(item => item.productVariantId)
			.map(item => {
				const price = item.unitPrice ? parseFloat(item.unitPrice) : 0;
				const name = item.variantName
					? `${item.productName} – ${item.variantName}`
					: item.productName;
				return {
					productVariantId: item.productVariantId!,
					stockItemId: item.stockItemId ?? undefined,
					quoteId: '',
					name,
					quantity: item.quantity,
					price,
					currency: item.currency as 'COP' | 'USD',
				};
			});
	};

	private buildProductReply = async (
		normalizedText: string,
		countryInfo: { currency: string; stockIds: string[] } | null,
		aiSearchQuery?: string,
	): Promise<{
		replyText: string;
		searchTerms: string[];
		productFound: boolean;
		suggestionsShown: boolean;
		products: ProductListEntry[];
		remainingProducts: ProductListEntry[];
		outOfStockProductName?: string;
	}> => {
		const stopWords = [
			// intención
			'producto',
			'precio',
			'tienes',
			'tienen',
			'hay',
			'busco',
			'buscando',
			'buscar',
			'buscas',
			'quiero',
			'necesito',
			'cuesta',
			'vale',
			'disponible',
			'stock',
			'venden',
			'vende',
			'interesa',
			'vendes',
			// verbos comunes
			'estoy',
			'estas',
			'tiene',
			'tengo',
			// artículos y preposiciones
			'el',
			'la',
			'los',
			'las',
			'un',
			'una',
			'unos',
			'unas',
			'de',
			'del',
			'al',
			'por',
			'para',
			'con',
			'sin',
			'en',
			'que',
			// conectores y filler words
			'favor',
			'tambien',
			'mas',
			'si',
			'no',
			'me',
			'puedo',
			'porfavor',
			'gracias',
			'hola',
			'buen',
			'buenos',
			'buenas',
			'dias',
			'tardes',
			'noches',
			'como',
			'esta',
			'ese',
			'esa',
			'este',
			'esto',
			'eso',
			'sus',
			'les',
			'nos',
		];

		// If AI provided a clean search query, use it directly (skip stopword filtering)
		const baseText = aiSearchQuery
			? normalizeText(aiSearchQuery)
			: normalizedText;

		const searchTerms = aiSearchQuery
			? baseText.split(' ').filter(w => w.length > 1 && !/^\d+$/.test(w))
			: normalizedText
					.split(' ')
					.filter(
						w => w.length > 2 && !stopWords.includes(w) && !/^\d+$/.test(w),
					);

		const expandedTerms = [
			...new Set(
				searchTerms.flatMap(t => [t, ...(SYNONYMS[stemTerm(t)] ?? [])]),
			),
		];

		if (searchTerms.length === 0) {
			return {
				replyText: '¿Qué producto buscas? Dime el nombre y te ayudo. 😊',
				searchTerms: [],
				productFound: false,
				suggestionsShown: false,
				products: [],
				remainingProducts: [],
			};
		}

		try {
			const stockItemWhere =
				countryInfo && countryInfo.stockIds.length > 0
					? { stockId: { [Op.in]: countryInfo.stockIds }, active: true }
					: { active: true };

			const variantInclude = {
				model: ProductVariantModel,
				as: 'productVariants',
				attributes: ['name', 'id'],
				include: [
					{
						model: StockItemModel,
						as: 'stockItems',
						attributes: ['id', 'quantity', 'price'],
						where: stockItemWhere,
						required: false,
					},
				],
			};

			// Búsqueda AND: todos los términos deben aparecer en el nombre.
			// Los términos en SYNONYM_REPLACEMENTS se reemplazan por su equivalente en BD
			// (ej: "esencia" → "fragancia") para evitar falsos positivos por substring.
			const effectiveTermsPerSearch = searchTerms.map(t => {
				const stem = stemTerm(t);
				return SYNONYM_REPLACEMENTS[stem] ?? [t];
			});

			let products = await ProductModel.findAll({
				attributes: ['id', 'name', 'description'],
				where: {
					[Op.and]: effectiveTermsPerSearch.map(terms => ({
						[Op.or]: terms.map(term =>
							sequelize.where(
								sequelize.fn('unaccent', sequelize.col('ProductModel.name')),
								{ [Op.iLike]: `%${stemTerm(term)}%` },
							),
						),
					})),
				},
				include: [variantInclude],
				limit: 20,
			});

			// Termsinos de sinónimos puros (no originales)
			const synonymOnlyTerms = expandedTerms.filter(
				t => !searchTerms.includes(t),
			);

			// Expandir sinónimos como OR alternativo SOLO cuando la búsqueda AND no encontró nada.
			// Si el AND ya encontró el producto específico (ej: "cera de palma" → "Cera de Palma / de Vaso"),
			// no agregar sinónimos genéricos (ej: "soya", "parafina") que contaminarían los resultados.
			if (synonymOnlyTerms.length > 0 && products.length === 0) {
				const synonymProducts = await ProductModel.findAll({
					attributes: ['id', 'name', 'description'],
					where: {
						[Op.or]: synonymOnlyTerms.map(term =>
							sequelize.where(
								sequelize.fn('unaccent', sequelize.col('ProductModel.name')),
								{ [Op.iLike]: `%${stemTerm(term)}%` },
							),
						),
					},
					include: [variantInclude],
					limit: 20,
				});
				// Fusionar deduplicando por id
				const existingIds = new Set(products.map(p => p.id));
				for (const p of synonymProducts) {
					if (!existingIds.has(p.id)) products.push(p);
				}
			}

			// Fallback OR: si no encontró nada con AND ni con sinónimos, buscar con cualquier término original
			if (products.length === 0 && searchTerms.length > 1) {
				console.log(
					'[WhatsApp Agent] AND search returned 0 results, trying OR fallback.',
				);
				products = await ProductModel.findAll({
					attributes: ['id', 'name', 'description'],
					where: {
						[Op.or]: expandedTerms.map(term =>
							sequelize.where(
								sequelize.fn('unaccent', sequelize.col('ProductModel.name')),
								{ [Op.iLike]: `%${stemTerm(term)}%` },
							),
						),
					},
					include: [variantInclude],
					limit: 20,
				});
			}

			type StockItem = { id: string; quantity: number; price: string };
			type Variant = { id: string; name: string; stockItems: StockItem[] };

			const currency = countryInfo?.currency ?? 'USD';

			// Scoring: relevancia textual + disponibilidad
			type ScoredProduct = {
				score: number;
				productId: string;
				name: string;
				description?: string;
				variants: Array<{
					variantId: string;
					stockItemId: string | null;
					name: string;
					totalQty: number;
					price: string | null;
				}>;
			};
			const scored: ScoredProduct[] = [];
			const outOfStockNames: string[] = [];

			for (const p of products) {
				const variants = p.get('productVariants') as Variant[] | undefined;
				const nameLower = normalizeText(p.name);
				const description = (p.get('description') as string | undefined) ?? '';

				const availableVariants = (variants ?? [])
					.map(v => {
						const totalQty = v.stockItems.reduce(
							(sum, si) => sum + Number(si.quantity),
							0,
						);
						const price = v.stockItems[0]?.price ?? null;
						const stockItemId = v.stockItems[0]?.id ?? null;
						return {
							variantId: v.id,
							stockItemId,
							name: v.name,
							totalQty,
							price,
						};
					})
					.filter(v => v.totalQty > 0);

				if (availableVariants.length === 0) {
					outOfStockNames.push(p.name);
					continue;
				}

				// Relevancia textual: cuántos términos coinciden y con qué precisión
				const nameWords = nameLower.split(/\s+/);

				// Word-boundary match: term matches a complete word in the name
				const wordMatchCount = searchTerms.filter(t => {
					const stem = stemTerm(t);
					return nameWords.some(w => w === stem || w.startsWith(stem));
				}).length;

				// Substring-only match: appears in name but NOT as a whole word
				// (e.g. "cera" inside "encerada")
				const substringMatchCount = searchTerms.filter(t => {
					const stem = stemTerm(t);
					const inName = nameLower.includes(stem);
					const isWord = nameWords.some(w => w === stem || w.startsWith(stem));
					return inName && !isWord;
				}).length;

				const descMatchCount = searchTerms.filter(t =>
					normalizeText(description).includes(stemTerm(t)),
				).length;
				const exactMatch = nameLower === searchTerms.join(' ') ? 1000 : 0;

				// Product-type bonus: search term is the first word of the product name
				const productTypeBonus = searchTerms.some(t => {
					const stem = stemTerm(t);
					return nameWords[0] === stem || nameWords[0]?.startsWith(stem);
				})
					? 50
					: 0;

				const startsWithMatch = searchTerms.some(t =>
					nameLower.startsWith(stemTerm(t)),
				)
					? 10
					: 0;
				const totalStock = availableVariants.reduce(
					(sum, v) => sum + v.totalQty,
					0,
				);

				// Relevance score (primary): determines product ordering tier
				const relevanceScore =
					exactMatch +
					productTypeBonus +
					wordMatchCount * 30 +
					substringMatchCount * 3 +
					descMatchCount * 3 +
					startsWithMatch +
					availableVariants.length;

				// Final score: relevance dominates, stock breaks ties within same tier
				const score = relevanceScore * 1000 + totalStock;

				scored.push({
					score,
					productId: String(p.id),
					name: p.name,
					description: description || undefined,
					variants: availableVariants,
				});
			}

			scored.sort((a, b) => b.score - a.score);

			if (scored.length === 0) {
				const outOfStockProductName =
					outOfStockNames.length > 0 ? outOfStockNames[0] : undefined;
				const suggestions = await this.buildSuggestions(
					searchTerms,
					stockItemWhere,
				);
				return {
					replyText: suggestions.replyText,
					searchTerms,
					productFound: false,
					suggestionsShown: suggestions.products.length > 0,
					products: suggestions.products,
					remainingProducts: suggestions.remainingProducts,
					outOfStockProductName,
				};
			}

			// Group products with same base name that differ only by color suffix.
			// e.g. "Pigmento para cera arena MORADO", "...AMARILLO" → one grouped entry.
			const KNOWN_COLORS = new Set([
				'morado',
				'amarillo',
				'rosado',
				'naranja',
				'verde',
				'magenta',
				'rojo',
				'azul',
				'negro',
				'blanco',
				'violeta',
				'lila',
				'turquesa',
				'dorado',
				'plateado',
				'celeste',
				'beige',
				'coral',
				'marfil',
				'chocolate',
				'cafe',
				'fucsia',
				'gris',
				'rosa',
				'aguamarina',
			]);
			const getBaseName = (name: string): string | null => {
				const words = normalizeText(name).split(/\s+/);
				if (words.length < 2) return null;
				const lastWord = words[words.length - 1];
				if (KNOWN_COLORS.has(lastWord)) return words.slice(0, -1).join(' ');
				return null;
			};

			// Build groups by base name
			const groupMap = new Map<string, ScoredProduct[]>();
			const ungrouped: ScoredProduct[] = [];
			for (const s of scored) {
				const baseName = getBaseName(s.name);
				if (baseName) {
					const group = groupMap.get(baseName) ?? [];
					group.push(s);
					groupMap.set(baseName, group);
				} else {
					ungrouped.push(s);
				}
			}

			// Collapse groups of 3+ into a single representative entry
			const collapsed: ScoredProduct[] = [...ungrouped];
			const groupedRemaining: ScoredProduct[] = [];
			for (const [, group] of groupMap.entries()) {
				if (group.length >= 3) {
					// Take highest scored as representative
					const [representative, ...rest] = group;
					const colorNames = group.map(g => {
						const words = g.name.split(/\s+/);
						return words[words.length - 1];
					});
					const totalGroupStock = group.reduce(
						(sum, g) => sum + g.variants.reduce((s, v) => s + v.totalQty, 0),
						0,
					);
					collapsed.push({
						...representative,
						name: representative.name.split(/\s+/).slice(0, -1).join(' '),
						description: `Disponible en ${group.length} colores: ${colorNames.join(', ')} (${totalGroupStock} unidades en total)`,
						// Keep representative's variants for price reference
					});
					groupedRemaining.push(...rest);
				} else {
					collapsed.push(...group);
				}
			}

			// Re-sort collapsed list by score
			collapsed.sort((a, b) => b.score - a.score);

			const displayedScored = collapsed.slice(0, MAX_PRODUCT_RESULTS);
			const remainingScored = [
				...collapsed.slice(MAX_PRODUCT_RESULTS),
				...groupedRemaining,
			];
			const lines = displayedScored.map((s, i) => {
				if (s.variants.length === 1) {
					const v = s.variants[0];
					const priceText = formatPrice(v.price, currency);
					const label = v.name ? `${s.name} ${v.name}` : s.name;
					return `${i + 1}. ${label} – ${priceText}`;
				}
				// Multi-variant: show product name with variant sub-list
				const variantLines = s.variants
					.map(
						v =>
							`   - ${v.name}: ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`,
					)
					.join('\n');
				return `${i + 1}. ${s.name}\n${variantLines}`;
			});
			const productList: ProductListEntry[] = displayedScored.map(s => ({
				productId: s.productId,
				name: s.name,
				description: s.description,
				variants: s.variants,
			}));
			const remainingProducts: ProductListEntry[] = remainingScored.map(s => ({
				productId: s.productId,
				name: s.name,
				description: s.description,
				variants: s.variants,
			}));

			const replyText = `Claro 😊 te muestro lo que tenemos:\n\n${lines.join('\n\n')}`;
			return {
				replyText,
				searchTerms,
				productFound: true,
				suggestionsShown: false,
				products: productList,
				remainingProducts,
			};
		} catch (error) {
			console.error('[WhatsApp Agent] Error searching products:', error);
			this.logService
				.logError({
					context: 'buildProductReply',
					error,
					rawText: normalizedText,
				})
				.catch(e =>
					console.error('[WhatsApp Agent] Failed to save error log:', e),
				);
			return {
				replyText:
					'Algo salió mal de mi lado 😕 ¿Puedes repetirme qué estás buscando?',
				searchTerms: [],
				productFound: false,
				suggestionsShown: false,
				products: [],
				remainingProducts: [],
			};
		}
	};

	private buildSuggestions = async (
		searchTerms: string[],
		stockItemWhere: object,
	): Promise<{
		replyText: string;
		products: ProductListEntry[];
		remainingProducts: ProductListEntry[];
	}> => {
		try {
			// Buscar productos que coincidan con los términos (sin filtro de stock)
			// para obtener sus categorías
			const matchingProducts = await ProductModel.findAll({
				attributes: ['id', 'productCategoryId'],
				where: {
					[Op.or]: searchTerms.map(term =>
						sequelize.where(
							sequelize.fn('unaccent', sequelize.col('ProductModel.name')),
							{ [Op.iLike]: `%${stemTerm(term)}%` },
						),
					),
				},
				limit: 10,
			});

			if (matchingProducts.length === 0) {
				return {
					replyText:
						'Mmm 🤔 no lo encontré con ese nombre. ¿Puedes contarme un poco más o qué tipo de insumo buscas?',
					products: [],
					remainingProducts: [],
				};
			}

			const categoryIds = [
				...new Set(
					matchingProducts
						.map(p => p.get('productCategoryId') as string)
						.filter(Boolean),
				),
			];

			type SuggestionVariant = {
				id: string;
				name: string;
				stockItems: { id: string; quantity: number; price: string }[];
			};

			// Buscar todos los productos en esas categorías con stock disponible (sin límite)
			const suggestions = await ProductModel.findAll({
				attributes: ['id', 'name', 'description'],
				where: {
					productCategoryId: { [Op.in]: categoryIds },
				},
				include: [
					{
						model: ProductVariantModel,
						as: 'productVariants',
						attributes: ['id', 'name'],
						include: [
							{
								model: StockItemModel,
								as: 'stockItems',
								attributes: ['id', 'quantity', 'price'],
								where: { ...stockItemWhere, quantity: { [Op.gt]: 0 } },
								required: true,
							},
						],
						required: true,
					},
				],
			});

			if (suggestions.length === 0) {
				return {
					replyText:
						'Ese producto no lo tenemos disponible ahora. ¿Puedes contarme más sobre lo que necesitas? 😊',
					products: [],
					remainingProducts: [],
				};
			}

			// Mapear a ProductListEntry y ordenar por mayor disponibilidad
			const allProducts: (ProductListEntry & { totalQty: number })[] =
				suggestions
					.map(p => {
						const variants = p.get('productVariants') as
							| SuggestionVariant[]
							| undefined;
						const availableVariants = (variants ?? []).map(v => ({
							variantId: v.id,
							stockItemId: v.stockItems[0]?.id ?? null,
							name: v.name,
							totalQty: v.stockItems.reduce(
								(sum, si) => sum + Number(si.quantity),
								0,
							),
							price: v.stockItems[0]?.price ?? null,
						}));
						const totalQty = availableVariants.reduce(
							(sum, v) => sum + v.totalQty,
							0,
						);
						return {
							productId: String(p.id),
							name: p.name,
							description:
								(p.get('description') as string | undefined) || undefined,
							variants: availableVariants,
							totalQty,
						};
					})
					.sort((a, b) => b.totalQty - a.totalQty);

			// Flatten multi-variant products: each variant becomes its own entry
			type FlatSuggestion = ProductListEntry & { totalQty: number };
			const flatProducts: FlatSuggestion[] = [];
			for (const p of allProducts) {
				if (p.variants.length === 1) {
					flatProducts.push(p);
				} else {
					for (const v of p.variants) {
						flatProducts.push({ ...p, variants: [v], totalQty: v.totalQty });
					}
				}
			}

			const productList: ProductListEntry[] = flatProducts
				.slice(0, MAX_PRODUCT_RESULTS)
				.map(
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					({ totalQty: _, ...p }) => p,
				);
			const remainingProducts: ProductListEntry[] = flatProducts
				.slice(MAX_PRODUCT_RESULTS)
				.map(
					// eslint-disable-next-line @typescript-eslint/no-unused-vars
					({ totalQty: _, ...p }) => p,
				);

			return { replyText: '', products: productList, remainingProducts };
		} catch (error) {
			console.error('[WhatsApp Agent] Error building suggestions:', error);
			this.logService
				.logError({ context: 'buildSuggestions', error })
				.catch(e =>
					console.error('[WhatsApp Agent] Failed to save error log:', e),
				);
			return {
				replyText:
					'No lo tenemos disponible en este momento. ¿Puedo ayudarte con otro insumo? 😊',
				products: [],
				remainingProducts: [],
			};
		}
	};

	private sendReply = async (
		to: string,
		botPhoneNumberId: string,
		replyText: string,
	) => {
		if (!ENV.WHATSAPP_ACCESS_TOKEN) {
			console.error('[WhatsApp Agent] WHATSAPP_ACCESS_TOKEN not set.');
			this.logService
				.logError({
					context: 'sendReply',
					error: new Error('WHATSAPP_ACCESS_TOKEN not set'),
					phoneNumber: to,
				})
				.catch(e =>
					console.error('[WhatsApp Agent] Failed to save error log:', e),
				);
			return;
		}

		try {
			await axios.post(
				`https://graph.facebook.com/v21.0/${botPhoneNumberId}/messages`,
				{
					messaging_product: 'whatsapp',
					to,
					type: 'text',
					text: {
						body: replyText,
					},
				},
				{
					headers: {
						Authorization: `Bearer ${ENV.WHATSAPP_ACCESS_TOKEN}`,
						'Content-Type': 'application/json',
					},
					timeout: WHATSAPP_API_TIMEOUT_MS,
				},
			);
			console.log(`[WhatsApp Agent] Reply sent to ${to}`);
		} catch (error) {
			if (error instanceof AxiosError) {
				if (error.code === 'ECONNABORTED') {
					console.error(`[WhatsApp Agent] Timeout sending reply to ${to}`);
					this.logService
						.logError({ context: 'sendReply:timeout', error, phoneNumber: to })
						.catch(e =>
							console.error('[WhatsApp Agent] Failed to save error log:', e),
						);
				} else {
					console.error(
						`[WhatsApp Agent] WhatsApp API error [${error.response?.status}]:`,
						error.response?.data,
					);
					this.logService
						.logError({
							context: `sendReply:apiError:${error.response?.status ?? 'unknown'}`,
							error,
							phoneNumber: to,
						})
						.catch(e =>
							console.error('[WhatsApp Agent] Failed to save error log:', e),
						);
				}
			} else {
				console.error(
					'[WhatsApp Agent] Unexpected error sending reply:',
					error,
				);
				this.logService
					.logError({ context: 'sendReply:unexpected', error, phoneNumber: to })
					.catch(e =>
						console.error('[WhatsApp Agent] Failed to save error log:', e),
					);
			}
		}
	};
}
