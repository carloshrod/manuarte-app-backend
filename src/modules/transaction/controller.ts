import { Handler } from 'express';
import { TransactionService } from './service';

export class TransactionController {
	private transactionService;

	constructor(transactionService: TransactionService) {
		this.transactionService = transactionService;
	}

	getAll: Handler = async (_req, res, next) => {
		try {
			const result = await this.transactionService.getAll();
			if (result.status === 200) {
				res.status(200).json(result.transactions);
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
