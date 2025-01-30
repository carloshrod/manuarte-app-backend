import { CreateBillingItemDto } from '../billing-item/types';

export enum BillingStatus {
	PAID = 'PAID',
	PENDING_PAYMENT = 'PENDING_PAYMENT',
	CANCELED = 'CANCELED',
}

export enum PaymentMethod {
	CASH = 'CASH',
	BANK_TRANSFER = 'BANK_TRANSFER',
	BANK_TRANSFER_RT = 'BANK_TRANSFER_RT',
	BANK_TRANSFER_RBT = 'BANK_TRANSFER_RBT',
	DEBIT_CARD = 'DEBIT_CARD',
	CREDIT_CARD = 'CREDIT_CARD',
	NEQUI = 'NEQUI',
	BOLD = 'BOLD',
	EFECTY = 'EFECTY',
	WOMPI = 'WOMPI',
	PAYPHONE = 'PAYPHONE',
	PAYPAL = 'PAYPAL',
	BANK_DEPOSIT = 'BANK_DEPOSIT',
	OTHER = 'OTHER',
}

export interface CreateBillingDto {
	shopSlug?: string;
	shopId?: string;
	status: BillingStatus;
	paymentMethod: PaymentMethod;
	total: number;
	shipping: string;
	currency: string;
	requestedBy: string;
	items: CreateBillingItemDto[];
}

export interface UpdateBillingDto extends CreateBillingDto {
	status: BillingStatus;
	paymentMethod: PaymentMethod;
}
