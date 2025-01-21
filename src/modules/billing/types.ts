import { CreateBillingItemDto } from '../billing-item/types';

export enum BillingStatus {
	PAID = 'PAID',
	PENDING_PAYMENT = 'PENDING_PAYMENT',
	CANCELED = 'CANCELED',
}

export enum PaymenMethodStatus {
	BANK_TRANSFER = 'BANK_TRANSFER',
	CASH = 'CASH',
	CREDIT_CARD = 'CREDIT_CARD',
	DEBIT_CARD = 'DEBIT_CARD',
	PAYPAL = 'PAYPAL',
	OTHER = 'OTHER',
}

export interface CreateBillingDto {
	shopSlug?: string;
	shopId?: string;
	status: BillingStatus;
	paymentMethod: PaymenMethodStatus;
	total: number;
	shipping: string;
	currency: string;
	requestedBy: string;
	items: CreateBillingItemDto[];
}

export interface UpdateBillingDto extends CreateBillingDto {
	id: string;
}
