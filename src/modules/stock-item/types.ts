export interface StockItem {
	stockId: string;
	currency: 'COP' | 'USD';
	price: number;
	quantity: number;
	cost: number;
	minQty: number;
	maxQty: number;
}

export interface PartialStockItem
	extends Omit<StockItem, 'stockId' | 'currency' | 'price' | 'cost'> {
	priceCop: number;
	costCop: number;
	priceUsd: number;
	costUsd: number;
}

export interface CreateStockItemDto extends StockItem {
	productVariantId: string;
	stockId: string;
}

export interface UpdateStockItemDto {
	id: string;
	stockItemData: CreateStockItemDto;
}

export interface UpdateMultipleStockItemDto {
	id: string;
	stockIds: string[];
	stockItemData: CreateStockItemDto & { priceUsd: number; costUsd: number };
}
