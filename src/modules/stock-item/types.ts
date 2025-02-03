export interface CreateStockItemDto {
	stockId: string;
	currency: 'COP' | 'USD';
	price: number;
	quantity: number;
	cost: number;
	productVariantId: string;
	shopSlug: string;
}
