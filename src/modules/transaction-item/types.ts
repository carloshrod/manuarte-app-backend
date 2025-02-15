export interface TransactionItem {
	id: string;
	transactionId: string;
	productVariantId: string;
	stockItemId: string;
	quantity: number;
	success: boolean;
	totalQuantity: number;
}

export type CreateTransactionItemDto = TransactionItem;
export type UpdateTransactionItemDto = TransactionItem;
