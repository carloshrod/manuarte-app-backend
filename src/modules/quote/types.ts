import { CreateQuoteItemDto } from '../quote-item/types';

export enum QuoteStatus {
	ACCEPTED = 'ACCEPTED',
	PENDING = 'PENDING',
	CANCELED = 'CANCELED',
	REVISION = 'REVISION',
	OVERDUE = 'OVERDUE',
}

export interface CreateQuoteDto {
	shopSlug?: string;
	shopId?: string;
	stockId?: string;
	items: CreateQuoteItemDto[];
	status: QuoteStatus;
	discountType: string;
	discount: number;
	shipping: number;
	requestedBy: string;
	currency?: 'COP' | 'USD';
	priceType?: 'PVP' | 'DIS';
}

export interface UpdateQuoteDto extends CreateQuoteDto {
	id: string;
}

export type QuoteFilters = {
	serialNumber?: string;
	status?: QuoteStatus;
	customerName?: string;
	dateStart?: string;
	dateEnd?: string;
};
