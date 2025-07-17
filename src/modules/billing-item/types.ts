import { Optional } from 'sequelize';

export type MonthlySalesData = {
	month: number;
	currency: string;
	totalSales: number;
};

export interface BillingItemDto {
	id: string;
	billingId: string;
	productVariantId: string;
	stockItemId: string;
	name: string;
	quantity: number;
	price: number;
	totalPrice: number;
	tax: number;
	currency: 'COP' | 'USD';
	createdDate: string;
	updatedDate: string;
	deletedDate: string;
	stockId: string;
	shopId?: string;
}

export type CreateBillingItemDto = Optional<
	BillingItemDto,
	'id' | 'tax' | 'createdDate' | 'updatedDate' | 'deletedDate'
>;
