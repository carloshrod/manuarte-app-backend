export interface TransactionItem {
	transactionId: string;
	productVariantId: string;
	stockItemId: string;
	quantity: number;
	success: boolean;
	totalQuantity: number;
}

export type CreateTransactionItemDto = TransactionItem;
