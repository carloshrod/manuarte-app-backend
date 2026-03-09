import axios, { AxiosError } from 'axios';
import { Op } from 'sequelize';
import { ENV } from '../../config/env';
import { ProductModel } from '../product/model';
import { ProductVariantModel } from '../product-variant/model';
import { StockItemModel } from '../stock-item/model';
import { StockModel } from '../stock/model';
import { ShopModel } from '../shop/model';
import { CountryModel } from '../country/model';
import { WhatsAppQueryLogModel } from './query-log.model';

const WHATSAPP_API_TIMEOUT_MS = 10_000;
const BUFFER_WAIT_MS = 4_000; // espera antes de procesar mensajes acumulados
const REPLY_DELAY_MS = 2_500; // delay para simular tiempo de escritura humano

interface BufferEntry {
	phoneNumberId: string;
	texts: string[];
	timer: ReturnType<typeof setTimeout>;
}

export class WhatsAppAgentService {
	private messageBuffer = new Map<string, BufferEntry>();

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

			const text = messages?.text?.body ?? null;
			const phoneNumberId = value?.metadata?.phone_number_id ?? null;
			const phoneNumber = messages?.from ?? null;
			const timestamp = messages?.timestamp ?? null;
			const message_id = messages?.id ?? null;

			console.log('[WhatsApp Agent] Incoming message:', {
				text,
				phoneNumberId,
				phoneNumber,
				timestamp,
				message_id,
			});

			if (!messages) {
				console.warn('[WhatsApp Agent] Event without messages, ignoring.');
				return { status: 200, message: 'Evento sin mensajes.' };
			}

			if (phoneNumber && phoneNumberId) {
				this.bufferMessage(phoneNumber, phoneNumberId, text ?? '');
			}
		} catch (error) {
			console.error('[WhatsApp Agent] Error processing message:', error);
			return { status: 500, message: 'Error interno del servidor.' };
		}
		return { status: 200, message: 'Mensaje recibido.' };
	};

	private bufferMessage = (
		phoneNumber: string,
		phoneNumberId: string,
		text: string,
	) => {
		const existing = this.messageBuffer.get(phoneNumber);

		if (existing) {
			clearTimeout(existing.timer);
			existing.texts.push(text);
		} else {
			this.messageBuffer.set(phoneNumber, {
				phoneNumberId,
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
			this.processAndReply(phoneNumber, entry.phoneNumberId, combined).catch(
				err => console.error('[WhatsApp Agent] Error in processAndReply:', err),
			);
		}, BUFFER_WAIT_MS);
	};

	private processAndReply = async (
		phoneNumber: string,
		phoneNumberId: string,
		text: string,
	) => {
		const normalizedText = this.normalizeText(text);
		const intent = this.detectIntent(normalizedText);
		console.log(`[WhatsApp Agent] Intent detected: ${intent}`);

		const countryInfo = await this.detectCountryFromPhone(phoneNumber);

		let replyText: string;

		if (intent === 'buscar_producto') {
			const result = await this.buildProductReply(normalizedText, countryInfo);
			replyText = result.replyText;
			this.logQuery({
				phoneNumber,
				phoneNumberId,
				rawText: text,
				searchTerms: result.searchTerms,
				productFound: result.productFound,
				suggestionsShown: result.suggestionsShown,
				replyText: result.replyText,
				countryPrefix: countryInfo
					? `+${phoneNumber.startsWith('593') ? '593' : '57'}`
					: null,
			}).catch(err =>
				console.error('[WhatsApp Agent] Error saving query log:', err),
			);
		} else {
			replyText = '¡Hola! Soy Gema 😊 ¿En qué te puedo ayudar el día de hoy?';
		}

		await new Promise(resolve => setTimeout(resolve, REPLY_DELAY_MS));
		await this.sendReply(phoneNumber, phoneNumberId, replyText);
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
			return null;
		}
	};

	private stemTerm = (word: string): string => {
		// Elimina sufijos plurales del español para que el iLike encuentre
		// tanto singular como plural: colorantes → colorante, colores → color
		if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
		if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
		return word;
	};

	private formatPrice = (price: string | null, currency: string): string => {
		if (!price) return 'precio no disponible';
		const num = Number(price);
		if (currency === 'COP') {
			return `$${num.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
		}
		return `$${num.toFixed(2)}`;
	};

	private normalizeText = (text: string): string => {
		return text
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '') // quitar tildes
			.replace(/[^a-z0-9\s]/g, '') // quitar caracteres especiales
			.trim();
	};

	private detectIntent = (normalizedText: string): string => {
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

		if (hasProductKeyword) return 'buscar_producto';
		return 'saludo';
	};

	private buildProductReply = async (
		normalizedText: string,
		countryInfo: { currency: string; stockIds: string[] } | null,
	): Promise<{
		replyText: string;
		searchTerms: string[];
		productFound: boolean;
		suggestionsShown: boolean;
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
			'también',
			'mas',
			'más',
			'si',
			'no',
			'me',
			'tengo',
			'puedo',
			'quiero',
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

		if (searchTerms.length === 0) {
			return {
				replyText:
					'¿Qué producto estás buscando? Por favor indícame el nombre. 🔍',
				searchTerms: [],
				productFound: false,
				suggestionsShown: false,
			};
		}

		try {
			const stockItemWhere =
				countryInfo && countryInfo.stockIds.length > 0
					? { stockId: { [Op.in]: countryInfo.stockIds } }
					: {};

			// Búsqueda AND: todos los términos deben aparecer en el nombre
			let products = await ProductModel.findAll({
				attributes: ['id', 'name'],
				where: {
					[Op.and]: searchTerms.map(term => ({
						name: { [Op.iLike]: `%${this.stemTerm(term)}%` },
					})),
				},
				include: [
					{
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
					},
				],
				limit: 20,
			});

			// Fallback OR: si no encontró nada con AND, buscar con cualquier término
			if (products.length === 0 && searchTerms.length > 1) {
				console.log(
					'[WhatsApp Agent] AND search returned 0 results, trying OR fallback.',
				);
				products = await ProductModel.findAll({
					attributes: ['id', 'name'],
					where: {
						[Op.or]: searchTerms.map(term => ({
							name: { [Op.iLike]: `%${term}%` },
						})),
					},
					include: [
						{
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
						},
					],
					limit: 20,
				});
			}

			type StockItem = { quantity: number; price: string };
			type Variant = { name: string; stockItems: StockItem[] };

			const currency = countryInfo?.currency ?? 'USD';
			const lines: string[] = [];

			for (const p of products) {
				const variants = p.get('productVariants') as Variant[] | undefined;

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

				const variantLines = availableVariants.map(v => {
					const priceText = this.formatPrice(v.price, currency);
					return `  - ${v.name}\n    Disponible: ${v.totalQty} unds · Precio: ${priceText}`;
				});

				lines.push(`• *${p.name}*\n${variantLines.join('\n')}`);
			}

			if (lines.length === 0) {
				const suggestionReply = await this.buildSuggestions(
					searchTerms,
					stockItemWhere,
				);
				return {
					replyText: suggestionReply,
					searchTerms,
					productFound: false,
					suggestionsShown: true,
				};
			}

			const MAX_RESULTS = 5;
			const displayed = lines.slice(0, MAX_RESULTS);
			const hasMore = lines.length > MAX_RESULTS;
			const footer = hasMore
				? `\n\n_Mostrando ${MAX_RESULTS} de ${lines.length} resultados. Si no ves lo que buscas, por favor sé más específico._ 🔍`
				: '';

			const replyText = `¡Claro! Aquí te cuento lo que tenemos disponible:\n\n${displayed.join('\n\n')}${footer}\n\n¿Te interesa alguno? 😊`;
			return {
				replyText,
				searchTerms,
				productFound: true,
				suggestionsShown: false,
			};
		} catch (error) {
			console.error('[WhatsApp Agent] Error searching products:', error);
			return {
				replyText:
					'Ocurrió un error al buscar el producto. Por favor intenta de nuevo. 🙏',
				searchTerms: [],
				productFound: false,
				suggestionsShown: false,
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
					[Op.or]: searchTerms.map(term => ({
						name: { [Op.iLike]: `%${this.stemTerm(term)}%` },
					})),
				},
				limit: 10,
			});

			if (matchingProducts.length === 0) {
				return `Lo siento, no encontré "${searchTerms.join(' ')}" en nuestro catálogo. ¿Puedes intentar con otro nombre? 🔍`;
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
				return `Lo siento, no tenemos "${searchTerms.join(' ')}" disponible en este momento. Si quieres, puedo ayudarte con otro producto. 😊`;
			}

			const suggestionLines = suggestions.map(p => `• ${p.name}`).join('\n');
			return `Lo siento, no tenemos ese producto en este momento. Pero tenemos:\n\n${suggestionLines}\n\n¿Te interesa alguno? 😊`;
		} catch (error) {
			console.error('[WhatsApp Agent] Error building suggestions:', error);
			return 'Lo siento, no tenemos ese producto disponible en este momento. 😊';
		}
	};

	private logQuery = async (data: {
		phoneNumber: string;
		phoneNumberId: string;
		rawText: string;
		searchTerms: string[];
		productFound: boolean;
		suggestionsShown: boolean;
		replyText: string;
		countryPrefix: string | null;
	}) => {
		await WhatsAppQueryLogModel.create({
			phoneNumber: data.phoneNumber,
			phoneNumberId: data.phoneNumberId,
			rawText: data.rawText,
			searchTerms: data.searchTerms,
			productFound: data.productFound,
			suggestionsShown: data.suggestionsShown,
			replyText: data.replyText,
			countryPrefix: data.countryPrefix,
		});
		console.log(
			`[WhatsApp Agent] Query log saved for ${data.phoneNumber} — found: ${data.productFound}, suggestions: ${data.suggestionsShown}`,
		);
	};

	private sendReply = async (
		to: string,
		phoneNumberId: string,
		replyText: string,
	) => {
		if (!ENV.WHATSAPP_ACCESS_TOKEN) {
			console.error('[WhatsApp Agent] WHATSAPP_ACCESS_TOKEN not set.');
			return;
		}

		try {
			await axios.post(
				`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
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
				} else {
					console.error(
						`[WhatsApp Agent] WhatsApp API error [${error.response?.status}]:`,
						error.response?.data,
					);
				}
			} else {
				console.error(
					'[WhatsApp Agent] Unexpected error sending reply:',
					error,
				);
			}
		}
	};
}
