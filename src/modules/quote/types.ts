import { CreateQuoteItemDto } from '../quote-item/types';

export enum EstimateStatus {
	ACCEPTED = 'ACCEPTED',
	PENDING = 'PENDING',
	CANCELED = 'CANCELED',
	REVISION = 'REVISION',
	OVERDUE = 'OVERDUE',
}

export interface CreateQuoteData {
	shopSlug?: string;
	shopId?: string;
	items: CreateQuoteItemDto[];
	status: EstimateStatus;
	dueDate: string | null;
	shipping: string;
	requestedBy: string;
	currency?: 'COP' | 'USD';
}

export interface UpdateQuoteData extends CreateQuoteData {
	id: string;
}
