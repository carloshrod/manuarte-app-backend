import crypto from 'crypto';
import { redis } from '../../../config/redis';
import { OpenAIService, OpenAIProduct } from '../openai.service';
import { PaymentLinkService } from '../payment-link.service';
import { ProductSearchService } from './product-search.service';
import { CountryContext } from './country.service';
import { WhatsAppLogService } from '../logging/log.service';
import { QuoteService } from '../../quote/service';
import { CustomerService } from '../../customer/service';
import { calculateTotals } from '../../docs/utils';
import { formatPrice, normalizeText } from '../utils';
import { SESSION_TTL_SECONDS, MAX_PRODUCT_RESULTS } from '../constants';
import {
	ProductListEntry,
	CartItem,
	PendingPurchaseFlow,
	UserSession,
} from '../types';
import { stripCallingCode } from '../helpers/intent-detection';
import {
	buildSelectionReply,
	buildResumptionReply,
	resolveVariant,
	parseVariantWeightGrams,
	detectRequestedWeightGrams,
	resolveVariantByWeight,
	buildOutOfStockResolutionMessage,
} from '../helpers/product-helpers';
import { addToCart } from '../helpers/cart-helpers';

export type IntentContext = {
	session: UserSession;
	phoneNumber: string;
	botPhoneNumberId: string;
	text: string;
	normalizedText: string;
	countryInfo: CountryContext | null;
	isFirstInteraction: boolean;
	hasActiveList: boolean;
	aiSearchQuery?: string;
	aiSelectionIndexes?: number[];
	aiVariantHint?: string;
	aiQuantity?: number;
	aiQuantities?: number[];
	aiRemoveProductHint?: string;
	aiAddProductHint?: string;
	aiCartEdits?: Array<{ productHint: string; quantity: number }>;
	aiProductList?: Array<{
		productHint: string;
		quantity: number;
		variantHint?: string;
		unit?: string;
	}>;
	isFirstEverInteraction?: boolean;
	knownCustomerName?: string;
};

export class IntentHandlerService {
	constructor(
		private openai: OpenAIService,
		private productSearchService: ProductSearchService,
		private quoteService: QuoteService,
		private paymentLinkService: PaymentLinkService,
		private customerService: CustomerService,
		private logService: WhatsAppLogService,
	) {}

	handle = async (intent: string, ctx: IntentContext): Promise<string> => {
		if (intent === 'resumption') {
			return this.handleIntentResumption(ctx);
		} else if (intent === 'select_product') {
			return this.handleIntentSelectProduct(ctx);
		} else if (intent === 'search_product') {
			return this.handleIntentSearchProduct(ctx);
		} else if (intent === 'show_more') {
			return this.handleIntentShowMore(ctx);
		} else if (intent === 'objection') {
			return this.handleIntentObjection(ctx);
		} else if (intent === 'affirmation') {
			return this.handleIntentAffirmation(ctx);
		} else if (intent === 'general_question') {
			return this.handleIntentGeneralQuestion(ctx);
		} else if (intent === 'product_followup') {
			return this.handleIntentProductFollowup(ctx);
		} else if (intent === 'edit_cart') {
			return this.handleIntentEditCart(ctx);
		} else if (intent === 'show_cart') {
			return this.handleIntentShowCart(ctx);
		} else if (intent === 'request_quote') {
			return this.handleIntentRequestQuote(ctx);
		} else if (intent === 'purchase_intent') {
			return this.handleIntentPurchaseIntent(ctx);
		} else {
			return this.openai
				.generateReply({
					userMessage: ctx.text,
					isFirstInteraction: ctx.isFirstInteraction,
					isFirstEverInteraction: ctx.isFirstEverInteraction,
					knownCustomerName: ctx.knownCustomerName,
				})
				.catch(() => 'Hola, soy Gema 👋 ¿En qué le puedo ayudar?');
		}
	};

	private handleIntentResumption = async (
		ctx: IntentContext,
	): Promise<string> => {
		const { session, text, countryInfo } = ctx;
		const lastProduct = session.lastProductList![0];
		const currency =
			session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
		return this.openai
			.generateReply({
				userMessage: text,
				resumptionProduct: lastProduct,
				currency,
			})
			.catch(() => buildResumptionReply(lastProduct));
	};

	private handleIntentSelectProduct = async (
		ctx: IntentContext,
	): Promise<string> => {
		const {
			session,
			phoneNumber,
			text,
			normalizedText,
			countryInfo,
			aiSelectionIndexes,
			aiVariantHint,
			aiQuantity,
			aiQuantities,
		} = ctx;
		const indexes = aiSelectionIndexes ?? [];
		const selectedItems = indexes
			.map(i => session.lastProductList?.[i - 1])
			.filter((p): p is ProductListEntry => !!p);

		if (selectedItems.length > 0) {
			const currency =
				session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';

			const firstVariantHint = aiVariantHint;
			const resolvedVariant = resolveVariant(
				selectedItems[0],
				firstVariantHint,
				normalizedText,
			);
			session.selectedProduct = selectedItems[0].name;
			session.selectedVariantName = resolvedVariant?.name;

			const requestedGramsInSelection =
				detectRequestedWeightGrams(normalizedText);

			let primaryItemQty: number | undefined;
			let primaryRequestedQty: number | undefined;
			let primaryCappedQty: number | undefined;

			for (let i = 0; i < selectedItems.length; i++) {
				const item = selectedItems[i];
				const itemVariantHint = i === 0 ? aiVariantHint : undefined;
				const itemVariant =
					i === 0
						? resolvedVariant
						: resolveVariant(item, itemVariantHint, normalizedText);
				const itemTotalQty = (
					itemVariant ? [itemVariant] : item.variants
				).reduce((sum, v) => sum + v.totalQty, 0);

				const variantGramsForItem = itemVariant
					? parseVariantWeightGrams(itemVariant.name)
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
				if (cappedQty && !stockExceededForItem) {
					addToCart(session, item, cappedQty, currency, itemVariant);
				}
			}

			await redis.set(
				`session:${phoneNumber}`,
				JSON.stringify(session),
				'EX',
				SESSION_TTL_SECONDS,
			);
			const selectedProductForReply = resolvedVariant
				? { ...selectedItems[0], variants: [resolvedVariant] }
				: selectedItems[0];

			const resolvedSelectedItems =
				selectedItems.length > 1
					? selectedItems.map((item, i) => {
							const hint = i === 0 ? aiVariantHint : undefined;
							const v =
								i === 0
									? resolvedVariant
									: resolveVariant(item, hint, normalizedText);
							return v ? { ...item, variants: [v] } : item;
						})
					: undefined;

			return this.openai
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
				.catch(() => buildSelectionReply(selectedProductForReply, currency));
		} else {
			const count = session.lastProductList!.length;
			return `Solo tengo ${count} opción${count !== 1 ? 'es' : ''} en la lista. Dígame un número del 1 al ${count}.`;
		}
	};

	private handleIntentSearchProduct = async (
		ctx: IntentContext,
	): Promise<string> => {
		const {
			session,
			phoneNumber,
			botPhoneNumberId,
			text,
			normalizedText,
			countryInfo,
			isFirstInteraction,
			aiSearchQuery,
			aiQuantity,
			aiVariantHint,
		} = ctx;
		const countryPrefix = phoneNumber.replace(/\d+$/, '');

		session.selectedProduct = undefined;
		const result = await this.productSearchService.buildProductReply(
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
			const requestedGrams = detectRequestedWeightGrams(normalizedText);

			if (requestedGrams !== null) {
				const resolved = resolveVariantByWeight(
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
						addToCart(
							session,
							product,
							cappedUnits,
							currency,
							resolved.variant,
						);
					}
					session.selectedProduct = product.name;
					session.selectedVariantName = resolved.variant.name;
					if (cappedUnits > 0) {
						autoAddedProduct = product;
						autoAddedQty = cappedUnits;
						autoAddedVariant = resolved.variant;
						if (stockExceeded) {
							const variantGrams = parseVariantWeightGrams(resolved.variant.name);
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
							autoAddedStockExceededNote = `El cliente pidió ${requestedLabel} pero solo hay ${availableLabel} disponible(s). NO confirmes el pedido ni calcules total. Informa brevemente la cantidad disponible en kg y pregunta si quiere esa cantidad. Varía la frase: "Solo tenemos X kg, ¿las quiere?" u otra variación natural. NUNCA uses frases como "te lo llevo", "te la llevo" ni similares.`;
							session.pendingStockConfirmQty = cappedUnits;
						}
					}
					console.log(
						`[WhatsApp Agent] Auto-added to cart from search (weight): ${product.name} – ${resolved.variant.name} x${cappedUnits} (${requestedGrams}g → ${resolved.units} units, capped: ${cappedUnits})`,
					);
				}
			} else if (product.variants.length === 1) {
				const variant = product.variants[0];
				const cappedUnits = Math.min(aiQuantity, variant.totalQty);
				const stockExceeded = cappedUnits < aiQuantity;
				if (!stockExceeded) {
					addToCart(session, product, cappedUnits, currency, variant);
				}
				session.selectedProduct = product.name;
				session.selectedVariantName = variant.name;
				if (cappedUnits > 0) {
					autoAddedProduct = product;
					autoAddedQty = cappedUnits;
					autoAddedVariant = variant;
					if (stockExceeded) {
						autoAddedRequestedQty = aiQuantity;
						session.pendingStockConfirmQty = cappedUnits;
					}
				}
				console.log(
					`[WhatsApp Agent] Auto-added to cart from search (single variant): ${product.name} – ${variant.name} x${cappedUnits}`,
				);
			} else if (aiVariantHint) {
				const resolved = resolveVariant(product, aiVariantHint, normalizedText);
				if (resolved) {
					const cappedUnits = Math.min(aiQuantity, resolved.totalQty);
					const stockExceeded = cappedUnits < aiQuantity;
					if (!stockExceeded) {
						addToCart(session, product, cappedUnits, currency, resolved);
					}
					session.selectedProduct = product.name;
					session.selectedVariantName = resolved.name;
					if (cappedUnits > 0) {
						autoAddedProduct = product;
						autoAddedQty = cappedUnits;
						autoAddedVariant = resolved;
						if (stockExceeded) {
							autoAddedRequestedQty = aiQuantity;
							session.pendingStockConfirmQty = cappedUnits;
						}
					}
					console.log(
						`[WhatsApp Agent] Auto-added to cart from search (variant hint "${aiVariantHint}"): ${product.name} – ${resolved.name} x${cappedUnits}`,
					);
				}
			}
		}

		await redis.set(
			`session:${phoneNumber}`,
			JSON.stringify(session),
			'EX',
			SESSION_TTL_SECONDS,
		);

		let replyText: string;
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
			console.error('[WhatsApp Agent] Error loggeando productos devueltos:', e);
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

		return replyText;
	};

	private handleIntentShowMore = async (
		ctx: IntentContext,
	): Promise<string> => {
		const { session, phoneNumber, text, countryInfo } = ctx;
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
			return this.openai
				.generateReply({
					userMessage: text,
					products: nextBatch,
					hasMoreProducts: newRemaining.length > 0,
					isShowingMore: true,
					currency,
				})
				.catch(
				() =>
					'Aquí hay más opciones, dígame cuál le interesa.',
			);
		} else if (session.lastSearchQuery) {
			session.selectedProduct = undefined;
			const result = await this.productSearchService.buildProductReply(
				normalizeText(session.lastSearchQuery),
				countryInfo ?? session.lastCountryInfo ?? null,
				session.lastSearchQuery,
			);
			session.lastProductList = result.products;
			session.remainingProductList = result.remainingProducts;
			session.awaitingMoreProducts = result.remainingProducts.length > 0;
			session.lastCountryInfo = countryInfo ?? session.lastCountryInfo ?? null;
			await redis.set(
				`session:${phoneNumber}`,
				JSON.stringify(session),
				'EX',
				SESSION_TTL_SECONDS,
			);
			return this.openai
				.generateReply({
					userMessage: text,
					products: result.products.length > 0 ? result.products : undefined,
					hasMoreProducts: result.remainingProducts.length > 0,
					isShowingMore: true,
					currency,
				})
				.catch(() => result.replyText);
		} else {
			return 'No tengo más opciones disponibles en este momento. ¿Puedo ayudarte con otra cosa?';
		}
	};

	private handleIntentObjection = async (
		ctx: IntentContext,
	): Promise<string> => {
		const { session, text, countryInfo } = ctx;
		const currency =
			session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
		const selectedProductEntry = session.lastProductList?.find(
			p => p.name === session.selectedProduct,
		);
		return this.openai
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
	};

	private handleIntentAffirmation = async (
		ctx: IntentContext,
	): Promise<string> => {
		const {
			session,
			phoneNumber,
			text,
			normalizedText,
			countryInfo,
			aiQuantity,
		} = ctx;
		const currency =
			session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
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
			const inlineQtyMatch = /\b(\d+)\b/.exec(normalizedText);
			const inlineQty = inlineQtyMatch
				? parseInt(inlineQtyMatch[1], 10)
				: undefined;
			const pendingQty = session.pendingStockConfirmQty;
			if (pendingQty !== undefined) session.pendingStockConfirmQty = undefined;
			const effectiveQtyAff =
				aiQuantity ?? bareNumberQtyAff ?? inlineQty ?? impliedQty ?? pendingQty;
			if (effectiveQtyAff) {
				addToCart(
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
			return this.openai
				.generateReply({
					userMessage: text,
					selectedProduct: productForAffReply,
					quantity: effectiveQtyAff,
					lastBotMessage: session.lastBotMessage,
					currency,
				})
				.catch(() => 'Claro, ¿en qué le puedo ayudar?');
		} else {
			return this.openai
				.generateReply({
					userMessage: text,
					intent: 'affirmation',
					lastBotMessage: session.lastBotMessage,
					products: session.lastProductList?.length
						? session.lastProductList
						: undefined,
					currency,
				})
				.catch(() => 'Claro, ¿en qué le puedo ayudar?');
		}
	};

	private handleIntentGeneralQuestion = async (
		ctx: IntentContext,
	): Promise<string> => {
		const { text, isFirstInteraction } = ctx;
		return this.openai
			.generateReply({
				userMessage: text,
				intent: 'general_question',
				isFirstInteraction,
			})
			.catch(
				() =>
					'Para esa consulta le recomiendo hablar directamente con nuestro equipo. ¿Le ayudo con algo más?',
			);
	};

	private handleIntentProductFollowup = async (
		ctx: IntentContext,
	): Promise<string> => {
		const { session, text, normalizedText, countryInfo, aiQuantity } = ctx;
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

			if (cappedQtyFollowup && !requestedQtyFollowup) {
				addToCart(
					session,
					selectedProductEntry,
					cappedQtyFollowup,
					currency,
					sessionVariant,
				);
			}
			return this.openai
				.generateReply({
					userMessage: text,
					selectedProduct: productForReply,
					lastBotMessage: session.lastBotMessage,
					quantity: cappedQtyFollowup,
					requestedQuantity: requestedQtyFollowup,
					currency,
				})
				.catch(() => 'Claro, ¿en qué más le puedo ayudar?');
		} else {
			return this.openai
				.generateReply({
					userMessage: text,
					selectedProduct: productForReply,
					lastBotMessage: session.lastBotMessage,
					quantity: aiQuantity,
					currency,
				})
				.catch(() => 'Claro, ¿en qué más le puedo ayudar?');
		}
	};

	private handleIntentEditCart = async (
		ctx: IntentContext,
	): Promise<string> => {
		const {
			session,
			text,
			normalizedText,
			countryInfo,
			aiQuantity,
			aiVariantHint,
			aiAddProductHint,
			aiRemoveProductHint,
			aiCartEdits,
		} = ctx;
		console.log(
			`[WhatsApp Agent] === EDIT_CART HANDLER === addHint: ${aiAddProductHint}, qty: ${aiQuantity}, removeHint: ${aiRemoveProductHint}, cartEdits: ${JSON.stringify(aiCartEdits)}`,
		);
		const currency =
			session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
		let removedProductName: string | undefined;
		let addedProductEntry: ProductListEntry | undefined;
		let addedQty: number | undefined;
		let updatedCartItemKey: string | undefined;

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
				if (hids.length > 0 && !hids.every(t => fullName.includes(t))) continue;
				const score = hwords.filter(t => fullName.includes(t)).length;
				if (score > bestScore) {
					bestScore = score;
					best = item;
				}
			}
			return bestScore > 0 ? best : undefined;
		};

		const isIncrement =
			/\b(agrega[r]?(?:s|as)?|agregu[ée][ns]?|a[nñ]ade[r]?(?:s|as)?|a[nñ]adi[ró]|sum[ae][r]?(?:s|as)?|sumemos)\b/i.test(
				normalizedText,
			) ||
			/\botr[ao]\b/i.test(normalizedText) ||
			/\d+\s*(?:kilo[s]?|kg|unidades?|u)?\.?\s+mas\b/i.test(normalizedText) ||
			/\bmas\s+de\b/i.test(normalizedText);

		if (aiAddProductHint && !(aiCartEdits && aiCartEdits.length > 0)) {
			const normalizedHint = normalizeText(aiAddProductHint);
			const hintWords = normalizedHint
				.split(/\s+/)
				.filter(t => !/\d/.test(t) && t.length > 2);

			const requestedGrams = detectRequestedWeightGrams(normalizedText);
			const cartItemToUpdate = findBestCartItemByHint(aiAddProductHint);
			console.log(
				`[WhatsApp Agent] edit_cart match: hint="${aiAddProductHint}", matched="${cartItemToUpdate?.productName ?? 'NONE'}${cartItemToUpdate?.variantName ? ` ${cartItemToUpdate.variantName}` : ''}", prevQty=${cartItemToUpdate?.quantity ?? 'N/A'}, isIncrement=${isIncrement}, aiQty=${aiQuantity}`,
			);

			if (cartItemToUpdate) {
				if (requestedGrams !== null && cartItemToUpdate.variantName) {
					const variantGrams = parseVariantWeightGrams(
						cartItemToUpdate.variantName,
					);
					if (variantGrams !== null) {
						addedQty = Math.ceil(requestedGrams / variantGrams);
					}
				}
				addedQty ??= aiQuantity ?? 1;

				const prevQty = cartItemToUpdate.quantity;
				cartItemToUpdate.quantity = isIncrement ? prevQty + addedQty : addedQty;
				updatedCartItemKey =
					cartItemToUpdate.productVariantId ?? cartItemToUpdate.productId;
				console.log(
					`[WhatsApp Agent] Cart qty ${isIncrement ? 'increased' : 'set'}: ` +
						`${cartItemToUpdate.productName} x${cartItemToUpdate.quantity}`,
				);

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
				addedQty = cartItemToUpdate.quantity;
			} else {
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
								grams: parseVariantWeightGrams(v.name),
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
					const resolvedVariantForEdit = session.selectedVariantName
						? addedProductEntry.variants.find(
								v => v.name === session.selectedVariantName,
							)
						: addedProductEntry.variants.length === 1
							? addedProductEntry.variants[0]
							: undefined;
					addToCart(
						session,
						addedProductEntry,
						addedQty,
						currency,
						resolvedVariantForEdit,
					);
				}
			}
		}

		if (aiRemoveProductHint && session.cart?.length) {
			const bestRemoveItem = findBestCartItemByHint(aiRemoveProductHint);
			const idx = bestRemoveItem ? session.cart.indexOf(bestRemoveItem) : -1;
			if (idx !== -1) {
				const target = session.cart[idx];
				const targetKey = target.productVariantId ?? target.productId;
				if (targetKey === updatedCartItemKey) {
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
			if (aiCartEdits.length > 1) {
				addedProductEntry = undefined;
				addedQty = undefined;
			}
		}

		const editReply = await this.openai
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
			.catch(() => 'Listo, actualicé su pedido. ¿Necesita algo más?');

		// Avoid unused variable warning
		void buildCartMatcher;
		void aiVariantHint;

		if (session.pendingQuoteFlow?.step === 'awaiting_cart_confirmation') {
			return editReply + '\n\n¿Quiere que le genere la cotización?';
		}
		return editReply;
	};

	private handleIntentShowCart = async (
		ctx: IntentContext,
	): Promise<string> => {
		const { session, text, countryInfo } = ctx;
		const currency =
			session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
		const reply = await this.openai
			.generateReply({
				userMessage: text,
				intent: 'show_cart',
				cart: session.cart,
				currency,
				knownCustomerName: session.knownCustomerName,
				hasShownCartByName: session.hasShownCartByName,
			})
			.catch(() => 'No tiene productos en su pedido todavía.');
		if (session.knownCustomerName && !session.hasShownCartByName) {
			session.hasShownCartByName = true;
		}
		return reply;
	};

	private handleIntentRequestQuote = async (
		ctx: IntentContext,
	): Promise<string> => {
		const { session, phoneNumber, text, countryInfo, aiProductList } = ctx;

		let outOfStockFromList: string[] = [];
		let outOfStockDetailsFromList: Array<{
			name: string;
			currentStock: number;
			alternatives: Array<{ name: string; stock: number }>;
		}> = [];
		if (aiProductList && aiProductList.length > 0) {
			const currency =
				session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
			const listResult =
				await this.productSearchService.processProductListItems(
					aiProductList,
					session,
					currency,
					countryInfo,
					'quote',
				);
			outOfStockFromList = listResult.outOfStock;
			outOfStockDetailsFromList = listResult.outOfStockDetails;
			console.log(
				`[WhatsApp Agent] Processed product list for quote: ${session.cart?.length ?? 0} items added to cart`,
			);
		}

		const isSingleProductFromList =
			aiProductList !== undefined && aiProductList.length === 1;

		if (!session.cart || session.cart.length === 0) {
			if (outOfStockFromList.length > 0) {
				return this.openai
					.generateReply({
						userMessage: text,
						outOfStockProductName: outOfStockFromList[0],
						products: undefined,
					})
					.catch(
						() =>
							`Lo sentimos, "${outOfStockFromList[0]}" no está disponible en este momento. ¿Le puedo ayudar con otra cosa?`,
					);
			}
			return 'Todavía no tiene productos en su pedido. Primero agregue lo que necesite y luego le armo la cotización.';
		} else if (isSingleProductFromList) {
			const currency =
				session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
			const lastCartItem = session.cart[session.cart.length - 1];
			const foundInList = session.lastProductList?.find(
				p => p.name === lastCartItem?.productName,
			);
			const foundVariant = foundInList?.variants.find(
				v => v.name === lastCartItem?.variantName,
			);
			const productForReply: OpenAIProduct =
				foundInList && foundVariant
					? { ...foundInList, variants: [foundVariant] }
					: (foundInList ?? {
							name: lastCartItem?.productName ?? '',
							description: undefined,
							variants: lastCartItem?.variantName
								? [
										{
											name: lastCartItem.variantName,
											price: lastCartItem.unitPrice ?? '0',
											totalQty: lastCartItem.quantity,
										},
									]
								: [],
						});
			await redis.set(
				`session:${phoneNumber}`,
				JSON.stringify(session),
				'EX',
				SESSION_TTL_SECONDS,
			);
			return this.openai
				.generateReply({
					userMessage: text,
					selectedProduct: productForReply,
					quantity: lastCartItem?.quantity,
					currency,
				})
				.catch(
					() =>
						`Listo, agregué ${lastCartItem?.productName ?? 'el producto'} a su pedido. ¿Necesita algo más?`,
				);
		} else {
			const currency =
				session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
			session.pendingQuoteFlow = {
				step: 'awaiting_cart_confirmation',
				outOfStockItems:
					outOfStockFromList.length > 0 ? outOfStockFromList : undefined,
			};
			const cartLines = session.cart
				.map(item => {
					const name = item.variantName
						? `${item.productName} ${item.variantName}`
						: item.productName;
					const total = item.unitPrice
						? formatPrice(
								String(Number(item.unitPrice) * item.quantity),
								item.currency,
							)
						: null;
					return total
						? `- ${item.quantity}x ${name} = ${total}`
						: `- ${item.quantity}x ${name}`;
				})
				.join('\n');
			const grandTotal = session.cart.reduce(
				(sum, item) =>
					sum + (item.unitPrice ? Number(item.unitPrice) * item.quantity : 0),
				0,
			);
			const grandTotalFormatted = formatPrice(String(grandTotal), currency);
			let replyText = `Aquí está su pedido:\n${cartLines}\n\nTotal: ${grandTotalFormatted}`;
			if (outOfStockDetailsFromList.length > 0) {
				const lines = outOfStockDetailsFromList
					.map(p => {
						const stockNote =
							p.currentStock > 0
								? `solo hay ${p.currentStock} disponible${p.currentStock !== 1 ? 's' : ''}`
								: 'sin stock';
						const altNote =
							p.alternatives.length > 0
								? `; también disponible en: ${p.alternatives.map(a => `${a.name} (${a.stock})`).join(', ')}`
								: '';
						return `- ${p.name} (${stockNote}${altNote})`;
					})
					.join('\n');
				replyText += `\n\n⚠️ Los siguientes productos no tienen stock suficiente:\n${lines}`;
			}
			replyText +=
				'\n\n¿Quiere generar una cotización o proceder con la compra?';
			await redis.set(
				`session:${phoneNumber}`,
				JSON.stringify(session),
				'EX',
				SESSION_TTL_SECONDS,
			);
			return replyText;
		}
	};

	private handleIntentPurchaseIntent = async (
		ctx: IntentContext,
	): Promise<string> => {
		const { session, phoneNumber, text, countryInfo } = ctx;
		const isoCode =
			session.lastCountryInfo?.isoCode ?? countryInfo?.isoCode ?? 'CO';
		const localPhone = stripCallingCode(phoneNumber);
		const cartItems = session.cart ?? [];
		const hasQuote = !!session.lastQuoteId && !!session.lastQuoteSerial;
		const hasCartItems = cartItems.length > 0;

		if (!hasCartItems && !hasQuote) {
			return 'Todavía no tiene productos en su pedido. Primero agregue lo que necesite y luego le ayudo a completar la compra.';
		} else if (hasQuote) {
			const currency =
				session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';
			const flow: PendingPurchaseFlow = {
				step: 'awaiting_receipt',
				purchaseFromQuote: true,
				quoteId: session.lastQuoteId,
				quoteSerial: session.lastQuoteSerial,
				currency,
			};

			const quoteResult = await this.quoteService.getOne(
				session.lastQuoteSerial!,
			);
			if (quoteResult.status === 200 && quoteResult.quote) {
				const quote = quoteResult.quote;
				flow.items = (quote.quoteItems ?? []).map(
					(qi: { name: string; quantity: number; price: number }) => ({
						productId: '',
						productName: qi.name,
						quantity: qi.quantity,
						unitPrice: String(qi.price),
						currency,
					}),
				);
				flow.total = calculateTotals(quote).total;
				flow.collectedData = {
					fullName: quote.fullName,
					dni: quote.dni,
					phoneNumber: quote.phoneNumber,
					location: quote.location,
					cityId: quote.cityId,
					cityName: quote.cityName
						? `${quote.cityName}${quote.regionName ? `, ${quote.regionName}` : ''}`
						: undefined,
					customerId: String(quote.customerId ?? ''),
				};
			}

			const paymentRef = crypto.randomUUID();
			const paymentLink = await this.paymentLinkService.getLinkForCountry(
				isoCode,
				flow.total ??
					flow.items?.reduce(
						(sum: number, i: CartItem) =>
							sum + (i.unitPrice ? parseFloat(i.unitPrice) * i.quantity : 0),
						0,
					) ??
					0,
				currency,
				paymentRef,
			);
			const provider = this.paymentLinkService.getProviderName(isoCode);
			flow.paymentRef = paymentRef;
			flow.paymentLink = paymentLink;
			session.pendingPurchaseFlow = flow;

			const itemLines =
				flow.items && flow.items.length > 0
					? flow.items
							.map((i: CartItem) => {
								const name = i.variantName
									? `${i.productName} – ${i.variantName}`
									: i.productName;
								return `  • ${i.quantity}x ${name}`;
							})
							.join('\n')
					: '';
			const totalStr =
				flow.total != null ? formatPrice(String(flow.total), currency) : '';

			return (
				`¡Perfecto! 🎉 Aquí tiene su link de pago con ${provider}:\n\n` +
				`🔗 ${paymentLink}\n\n` +
				(itemLines ? `Pedido:\n${itemLines}\n\n` : '') +
				(totalStr ? `Total: ${totalStr}\n\n` : '') +
				`Ref: ${paymentRef}\n\n` +
				`Cuando realice el pago, envíenos el comprobante (imagen o PDF) para que nuestro equipo lo verifique. 📩`
			);
		} else {
			const currency =
				session.lastCountryInfo?.currency ?? countryInfo?.currency ?? 'USD';

			const stockIds =
				session.lastCountryInfo?.stockIds ?? countryInfo?.stockIds ?? [];
			const { purchasableItems, blockedItems } =
				await this.productSearchService.filterCartItemsByStock(
					cartItems,
					stockIds,
				);

			if (purchasableItems.length === 0) {
				return 'Ninguno de los productos en su pedido tiene stock suficiente para procesar la compra en este momento. Si quiere, puedo generarle una cotización.';
			} else if (blockedItems.length > 0) {
				const blockedItemsContext = await Promise.all(
					blockedItems.map(async blocked => {
						const availableStock = blocked.stockItemId
							? await this.productSearchService.getAvailableStock(
									blocked.stockItemId,
									stockIds,
								)
							: 0;
						const productEntry = session.lastProductList?.find(
							p => p.productId === blocked.productId,
						);
						const alternatives = productEntry
							? productEntry.variants
									.filter(
										v =>
											v.variantId !== blocked.productVariantId &&
											v.totalQty > 0,
									)
									.map(v => ({
										variantId: v.variantId,
										name: v.name || '',
										stock: v.totalQty,
										unitPrice: v.price,
									}))
							: [];
						return { item: blocked, availableStock, alternatives };
					}),
				);

				session.pendingPurchaseFlow = {
					step: 'awaiting_out_of_stock_resolution',
					purchaseFromQuote: false,
					items: purchasableItems,
					currency,
					collectedData: { phoneNumber: localPhone },
					blockedItemsContext,
				};

				return buildOutOfStockResolutionMessage(blockedItemsContext);
			} else {
				const existingCustomer = await this.customerService.findByPhone(
					localPhone,
					isoCode,
				);
				if (existingCustomer) {
					session.pendingPurchaseFlow = {
						step: 'awaiting_confirmation',
						purchaseFromQuote: false,
						items: purchasableItems,
						currency,
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
					return this.openai
						.generateReply({
							userMessage: text,
							intent: 'existing_customer_purchase_confirmation',
							cart: purchasableItems,
							currency,
							purchaseFlowData: session.pendingPurchaseFlow.collectedData,
						})
						.catch(
							() =>
								`¡Hola de nuevo, ${existingCustomer.fullName}! Ya tengo sus datos. ¿Procedemos con la compra?`,
						);
				} else {
					session.pendingPurchaseFlow = {
						step: 'awaiting_customer_data',
						purchaseFromQuote: false,
						items: purchasableItems,
						currency,
						collectedData: { phoneNumber: localPhone },
					};
					return this.openai
						.generateReply({
							userMessage: text,
							intent: 'purchase_intent',
						})
						.catch(
							() =>
								'¡Claro! Para procesar su compra necesito su nombre completo y su número de cédula.',
						);
				}
			}
			await redis.set(
				`session:${phoneNumber}`,
				JSON.stringify(session),
				'EX',
				SESSION_TTL_SECONDS,
			);
		}
	};
}
