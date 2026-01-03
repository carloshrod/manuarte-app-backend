import { CashMovementModel } from './model';

export enum CashMovementCategory {
	SALE = 'SALE',
	ADVANCE_PAYMENT = 'ADVANCE_PAYMENT',
	DELIVERY = 'DELIVERY',
	INBOUND_SHIPPING = 'INBOUND_SHIPPING',
	PURCHASE = 'PURCHASE',
	CHANGE = 'CHANGE',
	PIGGY_BANK = 'PIGGY_BANK',
	SHORTAGE_COVER = 'SHORTAGE_COVER',
	OTHER = 'OTHER',
}

export type CreateCashMovementDTO = {
	shopId: string;
	billingPaymentId?: string;
	customerBalanceMovementId?: string;
	reference?: string;
	type: 'INCOME' | 'EXPENSE';
	category: CashMovementCategory;
	amount: number;
	comments?: string;
	createdBy?: string;
};

export type CashMovementWithCustomerName = CashMovementModel & {
	billingPayment?: {
		billing?: {
			customer?: {
				person?: {
					fullName?: string;
				};
			};
		};
	};
};
