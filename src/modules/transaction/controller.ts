import { Handler } from 'express';
import { TransactionService } from './service';
import { TransactionType } from './types';
import { TransactionItemService } from '../transaction-item/service';
import { TransactionItemModel } from '../transaction-item/model';

export class TransactionController {
	private transactionService;
	private transactionItemService;

	constructor(transactionService: TransactionService) {
		this.transactionService = transactionService;
		this.transactionItemService = new TransactionItemService(
			TransactionItemModel,
		);
	}

	getAll: Handler = async (req, res, next) => {
		try {
			const toId = (req.query.toId as string) || undefined;
			const result = await this.transactionService.getAll(toId);
			if (result.status === 200) {
				res.status(200).json(result.transactions);
				return;
			}

			res.sendStatus(result.status);
		} catch (error) {
			next(error);
		}
	};

	getItems: Handler = async (req, res, next) => {
		try {
			const { id } = req.params;
			const result = await this.transactionItemService.getByTransactionId(id);
			if (result.status === 200) {
				res.status(200).json(result.transactionItems);
				return;
			}

			res.sendStatus(result.status);
		} catch (error) {
			next(error);
		}
	};

	create: Handler = async (req, res, next) => {
		try {
			const result = await this.transactionService.create(req.body);

			if (result.status === 200) {
				let message;

				if (result.newTransaction?.supplierId) {
					message = 'Ingreso por proveedor realizado con éxito';
				}

				if (result.newTransaction?.type === TransactionType.EXIT) {
					message = 'Egreso realizado con éxito';
				}

				if (result.newTransaction?.type === TransactionType.TRANSFER) {
					message = 'Transferencia en progreso';
				}

				res.status(200).json({
					newTransaction: result.newTransaction,
					message,
				});
			}
		} catch (error) {
			next(error);
		}
	};
}
