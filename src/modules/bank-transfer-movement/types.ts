export type CreateBankTransferMovementDTO = {
	shopId: string;
	billingPaymentId?: string;
	reference?: string;
	type: 'INCOME' | 'EXPENSE';
	amount: number;
	comments?: string;
	createdBy?: string;
};
