export type CreateBankTransferMovementDTO = {
	shopId: string;
	billingPaymentId?: string;
	customerBalanceMovementId?: string;
	reference?: string;
	type: 'INCOME' | 'EXPENSE';
	amount: number;
	comments?: string;
	createdBy?: string;
};
