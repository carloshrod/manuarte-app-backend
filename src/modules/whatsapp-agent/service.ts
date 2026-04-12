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

interface UserSession {
	lastProductList?: ProductListEntry[];
	remainingProductList?: ProductListEntry[];
	awaitingMoreProducts?: boolean;
	lastSearchQuery?: string;
	lastCountryInfo?: { currency: string; stockIds: string[] } | null;
	selectedProduct?: string;
	selectedVariantName?: string;
	lastActivityAt?: number;
	lastBotMessage?: string;
	cart?: CartItem[];
}

const MAX_PRODUCT_RESULTS = 5;

export class WhatsAppAgentService {
	private messageBuffer = new Map<string, BufferEntry>();
	private processingQueue = new Map<string, Promise<void>>();
	private logService = new WhatsAppLogService();
	private openai = new OpenAIService();

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
				ENV.WHATSAPP_PHONE_NUMBER_ID &&
				botPhoneNumberId !== ENV.WHATSAPP_PHONE_NUMBER_ID
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
						const variantWeights = weightProductEntry.variants
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
							const unitsNeeded = Math.ceil(requestedGrams / largest.grams);
							intent = 'product_followup';
							aiQuantity = unitsNeeded;
							session.selectedProduct = weightProductEntry.name;
							session.selectedVariantName = largest.variant.name;
							console.log(
								`[WhatsApp Agent] Weight request: ${requestedGrams}g → ${unitsNeeded}x "${largest.variant.name}" (product: ${weightProductEntry.name})`,
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
							: this.resolveVariant(item, itemVariantHint);
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
									i === 0 ? resolvedVariant : this.resolveVariant(item, hint);
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
			session.lastProductList = result.products;
			session.remainingProductList = result.remainingProducts;
			session.awaitingMoreProducts = result.remainingProducts.length > 0;
			session.lastSearchQuery = aiSearchQuery ?? normalizedText;
			session.lastCountryInfo = countryInfo;
			await redis.set(
				`session:${phoneNumber}`,
				JSON.stringify(session),
				'EX',
				SESSION_TTL_SECONDS,
			);
			const currency = countryInfo?.currency ?? 'USD';
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
				const effectiveQtyAff =
					aiQuantity ?? bareNumberQtyAff ?? inlineQty ?? impliedQty;
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

	private detectCountryFromPhone = async (
		phoneNumber: string,
	): Promise<{ currency: string; stockIds: string[] } | null> => {
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

			const country = await CountryModel.findOne({
				where: {
					callingCode: { [Op.in]: [`+${matchedPrefix}`, matchedPrefix] },
				},
				attributes: ['id', 'currency'],
				include: [
					{
						model: ShopModel,
						as: 'shops',
						attributes: ['id'],
						include: [
							{
								model: StockModel,
								as: 'stock',
								attributes: ['id'],
								where: { isMain: false },
								required: false,
							},
						],
					},
				],
			});

			if (!country) return null;

			const shops = country.get('shops') as Array<{
				id: string;
				stock?: { id: string };
			}>;
			const stockIds = shops
				.map(s => s.stock?.id)
				.filter((id): id is string => !!id);

			const currency = (country.get('currency') as string | undefined) ?? 'USD';

			console.log(
				`[WhatsApp Agent] Country detected: +${matchedPrefix}, currency: ${currency}, stocks: ${stockIds.join(', ')}`,
			);
			return { currency, stockIds };
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
	): ProductListEntry['variants'][0] | undefined => {
		if (product.variants.length === 1) return product.variants[0];
		if (!hint) return undefined;
		const normalizedHint = normalizeText(hint);
		return (
			product.variants.find(v =>
				normalizeText(v.name).includes(normalizedHint),
			) ??
			product.variants.find(v => normalizedHint.includes(normalizeText(v.name)))
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

			// Si hay sinónimos, siempre lanzar consulta adicional OR con esos términos y fusionar
			if (synonymOnlyTerms.length > 0) {
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
				const matchCount = searchTerms.filter(t =>
					nameLower.includes(stemTerm(t)),
				).length;
				const descMatchCount = searchTerms.filter(t =>
					normalizeText(description).includes(stemTerm(t)),
				).length;
				const exactMatch = nameLower === searchTerms.join(' ') ? 100 : 0;
				const startsWithMatch = searchTerms.some(t =>
					nameLower.startsWith(stemTerm(t)),
				)
					? 10
					: 0;
				const totalStock = availableVariants.reduce(
					(sum, v) => sum + v.totalQty,
					0,
				);
				const score =
					exactMatch +
					matchCount * 20 +
					descMatchCount * 5 +
					startsWithMatch +
					availableVariants.length +
					totalStock;

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

			// Flatten multi-variant products: each variant becomes its own entry
			const flatScored: ScoredProduct[] = [];
			for (const s of scored) {
				if (s.variants.length === 1) {
					flatScored.push(s);
				} else {
					for (const v of s.variants) {
						flatScored.push({ ...s, variants: [v] });
					}
				}
			}

			const displayedScored = flatScored.slice(0, MAX_PRODUCT_RESULTS);
			const remainingScored = flatScored.slice(MAX_PRODUCT_RESULTS);
			const lines = displayedScored.map((s, i) => {
				const v = s.variants[0];
				const priceText = formatPrice(v.price, currency);
				const label = v.name ? `${s.name} ${v.name}` : s.name;
				return `${i + 1}. ${label} – ${priceText}`;
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
