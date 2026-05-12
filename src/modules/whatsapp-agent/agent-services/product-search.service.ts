import { Op } from 'sequelize';
import { sequelize } from '../../../config/database';
import { ProductModel } from '../../product/model';
import { ProductVariantModel } from '../../product-variant/model';
import { StockItemModel } from '../../stock-item/model';
import { WhatsAppLogService } from '../logging/log.service';
import {
	formatPrice,
	normalizeText,
	stemTerm,
	SYNONYMS,
	SYNONYM_REPLACEMENTS,
} from '../utils';
import { MAX_PRODUCT_RESULTS } from '../constants';
import { CartItem, ProductListEntry, UserSession } from '../types';
import {
	detectRequestedWeightGrams,
	resolveVariantByWeight,
	resolveVariant,
} from '../helpers/product-helpers';
import { addToCart } from '../helpers/cart-helpers';

export class ProductSearchService {
	constructor(private logService: WhatsAppLogService) {}

	filterCartItemsByStock = async (
		cartItems: CartItem[],
		stockIds: string[],
	): Promise<{ purchasableItems: CartItem[]; blockedItems: CartItem[] }> => {
		const purchasableItems: CartItem[] = [];
		const blockedItems: CartItem[] = [];

		for (const item of cartItems) {
			if (!item.stockItemId) {
				purchasableItems.push(item);
				continue;
			}
			try {
				const stockItem = await StockItemModel.findOne({
					where: {
						id: item.stockItemId,
						active: true,
						...(stockIds.length > 0 ? { stockId: { [Op.in]: stockIds } } : {}),
					},
					attributes: ['quantity'],
				});
				if (!stockItem || Number(stockItem.get('quantity')) < item.quantity) {
					blockedItems.push(item);
				} else {
					purchasableItems.push(item);
				}
			} catch {
				// En caso de error al consultar stock, incluir el ítem
				purchasableItems.push(item);
			}
		}

		return { purchasableItems, blockedItems };
	};

	/** Devuelve el stock disponible actual de un stockItem (0 si no existe). */
	getAvailableStock = async (
		stockItemId: string,
		stockIds: string[],
	): Promise<number> => {
		try {
			const si = await StockItemModel.findOne({
				where: {
					id: stockItemId,
					active: true,
					...(stockIds.length > 0 ? { stockId: { [Op.in]: stockIds } } : {}),
				},
				attributes: ['quantity'],
			});
			return si ? Number(si.get('quantity')) : 0;
		} catch {
			return 0;
		}
	};

	/**
	 * Procesa una lista de productos y los agrega al carrito de la sesión.
	 * Usado en request_quote y en los handlers de awaiting_confirmation.
	 * @returns objecto con número de productos agregados, lista de productos sin stock
	 *          y detalles de sin-stock con alternativas disponibles
	 */
	processProductListItems = async (
		items: Array<{
			productHint: string;
			quantity: number;
			variantHint?: string;
			unit?: string;
		}>,
		session: UserSession,
		currency: string,
		countryInfo: {
			currency: string;
			stockIds: string[];
			shopId: string;
			isoCode: string;
		} | null,
		mode: 'quote' | 'purchase' = 'purchase',
	): Promise<{
		added: number;
		outOfStock: string[];
		outOfStockDetails: Array<{
			name: string;
			currentStock: number;
			alternatives: Array<{ name: string; stock: number }>;
		}>;
	}> => {
		let added = 0;
		const outOfStock: string[] = [];
		const outOfStockDetails: Array<{
			name: string;
			currentStock: number;
			alternatives: Array<{ name: string; stock: number }>;
		}> = [];

		const pushOutOfStock = (
			hint: string,
			allVariants: Array<{ variantId: string; name: string; totalQty: number }>,
			chosenVariantId?: string,
			chosenStock = 0,
		) => {
			outOfStock.push(hint);
			const alternatives = allVariants
				.filter(v => v.variantId !== chosenVariantId && v.totalQty > 0)
				.map(v => ({ name: v.name, stock: v.totalQty }));
			outOfStockDetails.push({
				name: hint,
				currentStock: chosenStock,
				alternatives,
			});
		};

		for (const item of items) {
			try {
				const result = await this.buildProductReply(
					normalizeText(item.productHint),
					countryInfo ?? session.lastCountryInfo ?? null,
					item.productHint,
				);
				if (!result.productFound || result.products.length === 0) {
					console.log(
						`[WhatsApp Agent] Product list item not found: "${item.productHint}"`,
					);
					if (result.outOfStockProductName) {
						outOfStock.push(result.outOfStockProductName);
						outOfStockDetails.push({
							name: result.outOfStockProductName,
							currentStock: 0,
							alternatives: [],
						});
					}
					continue;
				}
				const product = result.products[0];
				const qty = Math.max(1, item.quantity || 1);
				const weightText = item.unit ? `${qty} ${item.unit}` : '';
				const requestedGrams = weightText
					? detectRequestedWeightGrams(weightText)
					: null;

				if (requestedGrams !== null) {
					const resolved = resolveVariantByWeight(
						product.variants,
						requestedGrams,
					);
					if (resolved) {
						const stock = resolved.variant.totalQty;
						const realName = [product.name, resolved.variant.name]
							.filter(Boolean)
							.join(' ')
							.trim();
						if (mode === 'purchase' && stock === 0) {
							pushOutOfStock(
								realName,
								product.variants,
								resolved.variant.variantId,
								stock,
							);
							continue;
						}
						const cartQty =
							mode === 'quote'
								? resolved.units
								: Math.min(resolved.units, stock);
						addToCart(session, product, cartQty, currency, resolved.variant);
						added++;
						if (stock < resolved.units) {
							pushOutOfStock(
								realName,
								product.variants,
								resolved.variant.variantId,
								stock,
							);
						}
					}
				} else if (item.variantHint) {
					const resolved = resolveVariant(
						product,
						item.variantHint,
						normalizeText(item.productHint),
					);
					if (resolved) {
						const stock = resolved.totalQty;
						const realName = [product.name, resolved.name]
							.filter(Boolean)
							.join(' ')
							.trim();
						if (mode === 'purchase' && stock === 0) {
							pushOutOfStock(
								realName,
								product.variants,
								resolved.variantId,
								stock,
							);
							continue;
						}
						const cartQty = mode === 'quote' ? qty : Math.min(qty, stock);
						addToCart(session, product, cartQty, currency, resolved);
						added++;
						if (stock < qty) {
							pushOutOfStock(
								realName,
								product.variants,
								resolved.variantId,
								stock,
							);
						}
					} else if (product.variants.length === 1) {
						const stock = product.variants[0].totalQty;
						const realName = [product.name, product.variants[0].name]
							.filter(Boolean)
							.join(' ')
							.trim();
						if (mode === 'purchase' && stock === 0) {
							pushOutOfStock(
								realName,
								product.variants,
								product.variants[0].variantId,
								stock,
							);
							continue;
						}
						const cartQty = mode === 'quote' ? qty : Math.min(qty, stock);
						addToCart(session, product, cartQty, currency, product.variants[0]);
						added++;
						if (stock < qty) {
							pushOutOfStock(
								realName,
								product.variants,
								product.variants[0].variantId,
								stock,
							);
						}
					}
				} else if (product.variants.length === 1) {
					const stock = product.variants[0].totalQty;
					const realName = [product.name, product.variants[0].name]
						.filter(Boolean)
						.join(' ')
						.trim();
					if (mode === 'purchase' && stock === 0) {
						pushOutOfStock(
							realName,
							product.variants,
							product.variants[0].variantId,
							stock,
						);
						continue;
					}
					const cartQty = mode === 'quote' ? qty : Math.min(qty, stock);
					addToCart(session, product, cartQty, currency, product.variants[0]);
					added++;
					if (stock < qty) {
						pushOutOfStock(
							realName,
							product.variants,
							product.variants[0].variantId,
							stock,
						);
					}
				}
			} catch (err) {
				console.error(
					`[WhatsApp Agent] Error processing product list item: "${item.productHint}"`,
					err,
				);
			}
		}
		return { added, outOfStock, outOfStockDetails };
	};

	buildProductReply = async (
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
				replyText: '¿Qué producto busca? Dígame el nombre y le ayudo. 😊',
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
					name: { [Op.notILike]: 'flete' },
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

			// Términos de sinónimos puros (no originales)
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
						name: { [Op.notILike]: 'flete' },
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
						name: { [Op.notILike]: 'flete' },
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
			const outOfStockIds: string[] = [];

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
					outOfStockIds.push(String(p.id));
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
					outOfStockIds.length > 0 ? outOfStockIds : undefined,
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

			const replyText = `Claro 😊 le muestro lo que tenemos:\n\n${lines.join('\n\n')}`;
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
					'Algo salió mal de mi lado 😕 ¿Puede repetirme qué está buscando?',
				searchTerms: [],
				productFound: false,
				suggestionsShown: false,
				products: [],
				remainingProducts: [],
			};
		}
	};

	buildSuggestions = async (
		searchTerms: string[],
		stockItemWhere: object,
		outOfStockProductIds?: string[],
	): Promise<{
		replyText: string;
		products: ProductListEntry[];
		remainingProducts: ProductListEntry[];
	}> => {
		try {
			// Buscar productos que coincidan con los términos (sin filtro de stock)
			// para obtener sus categorías.
			// Si tenemos IDs directos de productos sin stock, los usamos para lookup preciso.
			const matchingProducts =
				outOfStockProductIds && outOfStockProductIds.length > 0
					? await ProductModel.findAll({
							attributes: ['id', 'productCategoryId'],
							where: { id: { [Op.in]: outOfStockProductIds } },
						})
					: await ProductModel.findAll({
							attributes: ['id', 'productCategoryId'],
							where: {
								name: { [Op.notILike]: 'flete' },
								[Op.or]: searchTerms.map(term =>
									sequelize.where(
										sequelize.fn(
											'unaccent',
											sequelize.col('ProductModel.name'),
										),
										{ [Op.iLike]: `%${stemTerm(term)}%` },
									),
								),
							},
							limit: 10,
						});

			if (matchingProducts.length === 0) {
				return {
					replyText:
						'Mmm 🤔 no lo encontré con ese nombre. ¿Puede contarme un poco más o qué tipo de insumo busca?',
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
					name: { [Op.notILike]: 'flete' },
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
						'Ese producto no lo tenemos disponible ahora. ¿Puede contarme más sobre lo que necesita? 😊',
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
}
