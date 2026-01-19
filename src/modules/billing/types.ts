import { CreateBillingItemDto } from '../billing-item/types';

export enum BillingStatus {
	PAID = 'PAID',
	PENDING_PAYMENT = 'PENDING_PAYMENT',
	PARTIAL_PAYMENT = 'PARTIAL_PAYMENT',
	PENDING_DELIVERY = 'PENDING_DELIVERY',
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
	BALANCE = 'BALANCE',
	OTHER = 'OTHER',
}

export enum DiscountType {
	PERCENTAGE = 'PERCENTAGE',
	FIXED = 'FIXED',
}

export interface Payment {
	paymentMethod: PaymentMethod;
	amount: number;
	paymentReference?: string;
}

export interface CreateBillingDto {
	shopSlug?: string;
	shopId?: string;
	stockId?: string;
	status: BillingStatus;
	payments: Payment[];
	subtotal: number;
	discountType: string;
	discount: number;
	shipping: string;
	comments: string;
	currency: string;
	requestedBy: string;
	items: CreateBillingItemDto[];
	clientRequestId: string;
	balanceToUse?: number;
	quoteId?: string;
	priceType?: 'PVP' | 'DIS';
}

export interface UpdateBillingDto extends CreateBillingDto {
	status: BillingStatus;
	statusBefore: BillingStatus;
	paymentMethod: PaymentMethod;
	paymentCompleted?: boolean;
	stockId: string;
}

export type BillingFilters = {
	serialNumber?: string;
	status?: BillingStatus[];
	paymentMethods?: PaymentMethod[];
	customerName?: string;
	dateStart?: string;
	dateEnd?: string;
};
