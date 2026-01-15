import { Optional } from 'sequelize';

interface QuoteItemDto {
	id: string;
	quoteId: string;
	stockItemId?: string;
	productVariantId: string;
	name: string;
	quantity: number;
	price: number;
	totalPrice: number;
	tax: number;
	currency: 'COP' | 'USD';
	createdDate: string;
	updatedDate: string;
	deletedDate: string;
}

export type CreateQuoteItemDto = Optional<
	QuoteItemDto,
	| 'id'
	| 'price'
	| 'totalPrice'
	| 'tax'
	| 'createdDate'
	| 'updatedDate'
	| 'deletedDate'
>;
