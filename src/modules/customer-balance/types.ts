export interface CreateCustomerBalanceDto {
	customerId: string;
	currency: 'COP' | 'USD';
	balance?: number;
}

export enum CustomerBalanceMovementCategory {
	ADVANCE_PAYMENT = 'ADVANCE_PAYMENT',
	REFUND = 'REFUND',
	PAYMENT_APPLIED = 'PAYMENT_APPLIED',
	ADJUSTMENT = 'ADJUSTMENT',
	OTHER = 'OTHER',
}

export type PaymentMethodType =
	| 'CASH'
	| 'BANK_TRANSFER'
	| 'BANK_TRANSFER_RT'
	| 'BANK_TRANSFER_RBT'
	| 'DEBIT_CARD'
	| 'CREDIT_CARD'
	| 'NEQUI'
	| 'BOLD'
	| 'EFECTY'
	| 'WOMPI'
	| 'PAYPHONE'
	| 'PAYPAL'
	| 'BANK_DEPOSIT'
	| 'OTHER';

export interface AddCreditDto {
	customerId: string;
	currency: 'COP' | 'USD';
	amount: number;
	category: CustomerBalanceMovementCategory;
	paymentMethod?: PaymentMethodType;
	quoteId?: string;
	billingId?: string;
	shopId?: string;
	comments?: string;
	createdBy: string;
}

export interface UseBalanceDto {
	customerId: string;
	currency: 'COP' | 'USD';
	category: CustomerBalanceMovementCategory;
	amount: number;
	quoteId?: string;
	billingId?: string;
	comments?: string;
	createdBy: string;
}

export type CustomerBalanceMovementFilters = {
	currency?: 'COP' | 'USD';
	type?: 'CREDIT' | 'DEBIT';
	category?: CustomerBalanceMovementCategory;
	dateStart?: string;
	dateEnd?: string;
};
