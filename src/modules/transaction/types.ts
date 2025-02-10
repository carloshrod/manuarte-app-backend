import { CreateTransactionItemDto } from '../transaction-item/types';

export enum TransactionType {
	ENTER = 'ENTER',
	TRANSFER = 'TRANSFER',
	EXIT = 'EXIT',
}

export enum TransactionStatus {
	SUCCESS = 'SUCCESS',
	PROGRESS = 'PROGRESS',
}

export interface CreateTransactionDto {
	supplierId: string;
	fromId: string;
	toId: string;
	description: string;
	type: TransactionType;
	state: TransactionStatus;
	items: CreateTransactionItemDto[];
}
