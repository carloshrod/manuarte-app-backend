export interface StockItem {
	stockId: string;
	currency: 'COP' | 'USD';
	price: number;
	quantity: number;
	cost: number;
	minQty: number;
	maxQty: number;
	active?: boolean;
}

export interface PricesAndCosts {
	pvpCop: number;
	disCop?: number;
	costCop: number;
	pvpUsd: number;
	disUsd?: number;
	costUsd: number;
}

export interface PartialStockItem
	extends Omit<StockItem, 'stockId' | 'currency' | 'price' | 'cost'>,
		PricesAndCosts {}

export interface CreateStockItemDto extends StockItem {
	productVariantId: string;
	stockId: string;
	prices?: {
		PVP: number;
		DIS?: number;
	};
}

export interface UpdateStockItemDto {
	id: string;
	stockItemData: Partial<CreateStockItemDto> & {
		prices?: {
			PVP?: number;
			DIS?: number;
		};
	};
}

export interface UpdateMultipleStockItemDto {
	id: string;
	stockIds: string[];
	stockItemData: CreateStockItemDto & PricesAndCosts;
}

export interface UpdateStockItemQtyDto {
	quantity: number;
	name: string;
	productVariantId: string;
	stockId: string;
}

export enum StockOperation {
	ADD = 'add',
	SUBTRACT = 'subtract',
}

export type StockItemFilters = {
	productName?: string;
	productVariantName?: string;
};

export type StockHistoryTransactionType =
	| 'ENTER'
	| 'EXIT'
	| 'TRANSFER'
	| 'BILLING';

export type StockItemFiltersHistory = {
	dateStart?: string;
	dateEnd?: string;
	type?: StockHistoryTransactionType;
	identifier?: string;
};
