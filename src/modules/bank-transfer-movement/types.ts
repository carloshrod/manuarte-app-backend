export type CreateBankTransferMovementDTO = {
	shopId: string;
	billingPaymentId?: string;
	customerBalanceMovementId?: string;
	reference?: string;
	type: 'INCOME' | 'EXPENSE';
	paymentMethod?: string;
	amount: number;
	comments?: string;
	createdBy?: string;
};
