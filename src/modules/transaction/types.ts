import { CreateTransactionItemDto } from '../transaction-item/types';

export enum TransactionType {
	ENTER = 'ENTER',
	TRANSFER = 'TRANSFER',
	EXIT = 'EXIT',
}

export enum TransactionState {
	SUCCESS = 'SUCCESS',
	PROGRESS = 'PROGRESS',
}

export interface CreateTransactionDto {
	supplierId: string;
	fromId: string;
	toId: string;
	description: string;
	type: TransactionType;
	state: TransactionState;
	items: CreateTransactionItemDto[];
	transferId?: string;
}

export type UpdateTransactionDto = Partial<CreateTransactionDto>;
