import { CartItem, ProductListEntry, UserSession } from '../types';

export function addToCart(
	session: UserSession,
	product: ProductListEntry,
	quantity: number,
	currency: string,
	variantOverride?: ProductListEntry['variants'][0],
): void {
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
}

export function mapCartToQuoteItems(cart: CartItem[]): Array<{
	productVariantId: string;
	stockItemId?: string;
	quoteId: string;
	name: string;
	quantity: number;
	price: number;
	currency: 'COP' | 'USD';
}> {
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
}
