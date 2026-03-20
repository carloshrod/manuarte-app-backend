import axios, { AxiosError } from 'axios';
import { Op } from 'sequelize';
import { sequelize } from '../../config/database';
import { ENV } from '../../config/env';
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
const BUFFER_WAIT_MS = 4_000; // espera antes de procesar mensajes acumulados
const REPLY_DELAY_MS = 2_500; // delay para simular tiempo de escritura humano

interface BufferEntry {
	botPhoneNumberId: string;
	texts: string[];
	timer: ReturnType<typeof setTimeout>;
}

interface ProductListEntry {
	name: string;
	description?: string;
	variants: Array<{ name: string; totalQty: number; price: string | null }>;
}

interface UserSession {
	lastProductList?: ProductListEntry[];
	remainingProductList?: ProductListEntry[];
	awaitingMoreProducts?: boolean;
	lastCountryInfo?: { currency: string; stockIds: string[] } | null;
	selectedProduct?: string;
	lastActivityAt?: number;
	lastBotMessage?: string;
}

const MAX_PRODUCT_RESULTS = 5;

export class WhatsAppAgentService {
	private messageBuffer = new Map<string, BufferEntry>();
	private logService = new WhatsAppLogService();
	private userSessions = new Map<string, UserSession>();
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
		const normalizedText = normalizeText(text);
		const countryInfo = await this.detectCountryFromPhone(phoneNumber);
		const countryPrefix = countryInfo
			? `+${phoneNumber.startsWith('593') ? '593' : '57'}`
			: null;

		const session = this.userSessions.get(phoneNumber) ?? {};
		const now = Date.now();
		const RESUMPTION_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutos
		const hasActiveList = (session.lastProductList?.length ?? 0) > 0;
		const isFirstInteraction = !session.lastActivityAt;
		const isResumption =
			!isFirstInteraction &&
			now - session.lastActivityAt! > RESUMPTION_THRESHOLD_MS &&
			hasActiveList;

		session.lastActivityAt = now;
		this.userSessions.set(phoneNumber, session);

		const selectionIndex = this.detectSelection(normalizedText);
		const nameSelectionIndex =
			selectionIndex === null && hasActiveList
				? this.detectSelectionByName(
						normalizedText,
						session.lastProductList ?? [],
					)
				: null;
		const effectiveSelectionIndex = selectionIndex ?? nameSelectionIndex;
		const detectedIntent = this.detectIntent(normalizedText);
		const intent =
			isResumption && detectedIntent !== 'search_product'
				? 'resumption'
				: effectiveSelectionIndex !== null && hasActiveList
					? 'select_product'
					: detectedIntent === 'show_more' && !session.awaitingMoreProducts
						? 'search_product'
						: detectedIntent;
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
			const selected = session.lastProductList![effectiveSelectionIndex! - 1];
			if (selected) {
				session.selectedProduct = selected.name;
				this.userSessions.set(phoneNumber, session);
				const currency =
					session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
				replyText = await this.openai
					.generateReply({
						userMessage: text,
						selectedProduct: selected,
						currency,
					})
					.catch(() => this.buildSelectionReply(selected, currency));
			} else {
				const count = session.lastProductList!.length;
				replyText = `Solo tengo ${count} opción${count !== 1 ? 'es' : ''} en la lista. Dime un número del 1 al ${count}.`;
			}
		} else if (intent === 'search_product') {
			session.selectedProduct = undefined;
			const result = await this.buildProductReply(normalizedText, countryInfo);
			session.lastProductList = result.products;
			session.remainingProductList = result.remainingProducts;
			session.awaitingMoreProducts = result.remainingProducts.length > 0;
			session.lastCountryInfo = countryInfo;
			this.userSessions.set(phoneNumber, session);
			const currency = countryInfo?.currency ?? 'USD';
			replyText = await this.openai
				.generateReply({
					userMessage: text,
					products: result.products.length > 0 ? result.products : undefined,
					hasMoreProducts: result.remainingProducts.length > 0,
					isFirstInteraction,
					currency,
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
			const nextBatch = (session.remainingProductList ?? []).slice(
				0,
				MAX_PRODUCT_RESULTS,
			);
			const newRemaining = (session.remainingProductList ?? []).slice(
				MAX_PRODUCT_RESULTS,
			);
			session.lastProductList = nextBatch;
			session.remainingProductList = newRemaining;
			session.awaitingMoreProducts = newRemaining.length > 0;
			this.userSessions.set(phoneNumber, session);
			replyText = await this.openai
				.generateReply({
					userMessage: text,
					products: nextBatch,
					hasMoreProducts: newRemaining.length > 0,
					isShowingMore: true,
					currency,
				})
				.catch(() => 'Aquí hay más opciones, dime cuál te interesa.');
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
		} else {
			replyText = await this.openai
				.generateReply({ userMessage: text, isFirstInteraction })
				.catch(() => 'Hola, soy Gema 👋 ¿En qué te puedo ayudar?');
		}

		// Guardar último mensaje del bot en la sesión para contexto en próximas respuestas
		session.lastBotMessage = replyText;
		this.userSessions.set(phoneNumber, session);

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

		// Detect "show more products" intent (before affirmation check)
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
		// Short single-word exact matches that only mean "show more" in context
		const showMoreExact = /^(mas|otros|otras|siguiente|siguientes)[,!.\s?]*$/i;
		if (
			showMorePhrases.some(p => normalizedText.includes(p)) ||
			showMoreExact.test(normalizedText.trim())
		)
			return 'show_more';

		// Detect affirmation-only messages (e.g. "Vale", "Sí", "Ok", "Dale")
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
			'tienen',
			'vendes',
		];

		const hasProductKeyword = productKeywords.some(kw =>
			normalizedText.includes(kw),
		);

		if (hasProductKeyword) return 'search_product';

		// Detect product queries without explicit keywords (e.g. "cera de palma")
		const words = normalizedText.split(' ');
		const knownProductTerms = new Set(Object.keys(SYNONYMS));
		const hasKnownProductTerm = words.some(
			w => knownProductTerms.has(w) || knownProductTerms.has(stemTerm(w)),
		);
		if (hasKnownProductTerm) return 'search_product';

		// If there are substantive words after filtering greetings/acks, treat as product search
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
			if (score > bestScore) {
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

	private buildProductReply = async (
		normalizedText: string,
		countryInfo: { currency: string; stockIds: string[] } | null,
	): Promise<{
		replyText: string;
		searchTerms: string[];
		productFound: boolean;
		suggestionsShown: boolean;
		products: ProductListEntry[];
		remainingProducts: ProductListEntry[];
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

		const searchTerms = normalizedText
			.split(' ')
			.filter(w => w.length > 2 && !stopWords.includes(w) && !/^\d+$/.test(w));

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
					? { stockId: { [Op.in]: countryInfo.stockIds } }
					: {};

			const variantInclude = {
				model: ProductVariantModel,
				as: 'productVariants',
				attributes: ['name', 'id'],
				include: [
					{
						model: StockItemModel,
						as: 'stockItems',
						attributes: ['quantity', 'price'],
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
						[Op.or]: terms.flatMap(term => [
							sequelize.where(
								sequelize.fn('unaccent', sequelize.col('ProductModel.name')),
								{ [Op.iLike]: `%${stemTerm(term)}%` },
							),
							sequelize.where(
								sequelize.fn(
									'unaccent',
									sequelize.col('ProductModel.description'),
								),
								{ [Op.iLike]: `%${stemTerm(term)}%` },
							),
						]),
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
						[Op.or]: synonymOnlyTerms.flatMap(term => [
							sequelize.where(
								sequelize.fn('unaccent', sequelize.col('ProductModel.name')),
								{ [Op.iLike]: `%${stemTerm(term)}%` },
							),
							sequelize.where(
								sequelize.fn(
									'unaccent',
									sequelize.col('ProductModel.description'),
								),
								{ [Op.iLike]: `%${stemTerm(term)}%` },
							),
						]),
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
						[Op.or]: expandedTerms.flatMap(term => [
							sequelize.where(
								sequelize.fn('unaccent', sequelize.col('ProductModel.name')),
								{ [Op.iLike]: `%${stemTerm(term)}%` },
							),
							sequelize.where(
								sequelize.fn(
									'unaccent',
									sequelize.col('ProductModel.description'),
								),
								{ [Op.iLike]: `%${stemTerm(term)}%` },
							),
						]),
					},
					include: [variantInclude],
					limit: 20,
				});
			}

			type StockItem = { quantity: number; price: string };
			type Variant = { name: string; stockItems: StockItem[] };

			const currency = countryInfo?.currency ?? 'USD';

			// Scoring: relevancia textual + disponibilidad
			type ScoredProduct = {
				score: number;
				name: string;
				description?: string;
				variants: Array<{
					name: string;
					totalQty: number;
					price: string | null;
				}>;
			};
			const scored: ScoredProduct[] = [];

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
						return { name: v.name, totalQty, price };
					})
					.filter(v => v.totalQty > 0);

				if (availableVariants.length === 0) continue;

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
					name: p.name,
					description: description || undefined,
					variants: availableVariants,
				});
			}

			scored.sort((a, b) => b.score - a.score);

			if (scored.length === 0) {
				const suggestionReply = await this.buildSuggestions(
					searchTerms,
					stockItemWhere,
				);
				return {
					replyText: suggestionReply,
					searchTerms,
					productFound: false,
					suggestionsShown: true,
					products: [],
					remainingProducts: [],
				};
			}

			const displayedScored = scored.slice(0, MAX_PRODUCT_RESULTS);
			const remainingScored = scored.slice(MAX_PRODUCT_RESULTS);
			const lines = displayedScored.map((s, i) => {
				if (s.variants.length === 1) {
					const v = s.variants[0];
					const priceText = formatPrice(v.price, currency);
					const label = v.name ? `${s.name} ${v.name}` : s.name;
					return `${i + 1}. ${label} – ${priceText}`;
				}
				const variantLines = s.variants.map(v => {
					const priceText = formatPrice(v.price, currency);
					return `  - ${v.name} – ${priceText}`;
				});
				return `*${i + 1}. ${s.name}*\n${variantLines.join('\n')}`;
			});
			const productList: ProductListEntry[] = displayedScored.map(s => ({
				name: s.name,
				description: s.description,
				variants: s.variants,
			}));
			const remainingProducts: ProductListEntry[] = remainingScored.map(s => ({
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
	): Promise<string> => {
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
				return `Mmm 🤔 no lo encontré con ese nombre. ¿Puedes contarme un poco más o qué tipo de insumo buscas?`;
			}

			const categoryIds = [
				...new Set(
					matchingProducts
						.map(p => p.get('productCategoryId') as string)
						.filter(Boolean),
				),
			];

			// Buscar productos en esas categorías con stock disponible
			const suggestions = await ProductModel.findAll({
				attributes: ['id', 'name'],
				where: {
					productCategoryId: { [Op.in]: categoryIds },
				},
				include: [
					{
						model: ProductVariantModel,
						as: 'productVariants',
						attributes: ['id'],
						include: [
							{
								model: StockItemModel,
								as: 'stockItems',
								attributes: ['quantity'],
								where: { ...stockItemWhere, quantity: { [Op.gt]: 0 } },
								required: true,
							},
						],
						required: true,
					},
				],
				limit: 5,
			});

			if (suggestions.length === 0) {
				return `Ese producto no lo tenemos disponible ahora. ¿Puedes contarme más sobre lo que necesitas? 😊`;
			}

			const suggestionLines = suggestions.map(p => `• ${p.name}`).join('\n');
			return `No lo tenemos en este momento, pero quizás alguno de estos te sirva 😊\n\n${suggestionLines}\n\n¿Alguno te ayuda?`;
		} catch (error) {
			console.error('[WhatsApp Agent] Error building suggestions:', error);
			this.logService
				.logError({ context: 'buildSuggestions', error })
				.catch(e =>
					console.error('[WhatsApp Agent] Failed to save error log:', e),
				);
			return 'No lo tenemos disponible en este momento. ¿Puedo ayudarte con otro insumo? 😊';
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
