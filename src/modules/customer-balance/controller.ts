import { Handler } from 'express';
import { CustomerBalanceService } from './service';
import { CustomRequest } from '../types';
import { CustomerBalanceMovementCategory } from './types';

export class CustomerBalanceController {
	private customerBalanceService;

	constructor(customerBalanceService: CustomerBalanceService) {
		this.customerBalanceService = customerBalanceService;
	}

	getBalance: Handler = async (req, res, next) => {
		try {
			const { customerId } = req.params;
			const { currency } = req.query;

			if (!currency || (currency !== 'COP' && currency !== 'USD')) {
				res.status(400).json({
					message: 'Currency is required and must be COP or USD',
				});
				return;
			}

			const balance = await this.customerBalanceService.getBalance(
				customerId,
				currency as 'COP' | 'USD',
			);

			res.status(200).json({ balance });
		} catch (error) {
			next(error);
		}
	};

	getAllBalances: Handler = async (req, res, next) => {
		try {
			const { customerId } = req.params;

			const result =
				await this.customerBalanceService.getAllBalances(customerId);

			res.status(result.status).json(result.data);
		} catch (error) {
			next(error);
		}
	};

	addCredit: Handler = async (req, res, next) => {
		try {
			const { customerId } = req.params;
			const {
				currency,
				amount,
				category,
				paymentMethod,
				quoteId,
				billingId,
				shopId,
				comments,
			} = req.body;
			const requestedBy = (req as CustomRequest).requestedBy;

			if (!currency || !amount || !category) {
				res.status(400).json({
					message: 'Currency, amount and category are required',
				});
				return;
			}

			const result = await this.customerBalanceService.addCredit({
				customerId,
				currency,
				amount: Number(amount),
				category,
				paymentMethod,
				quoteId,
				billingId,
				shopId,
				comments,
				createdBy: requestedBy,
			});

			res.status(result.status).json({
				movement: result.movement,
				message: 'Crédito agregado con éxito',
			});
		} catch (error) {
			next(error);
		}
	};

	useBalance: Handler = async (req, res, next) => {
		try {
			const { customerId } = req.params;
			const { currency, amount, category, quoteId, billingId, comments } =
				req.body;
			const requestedBy = (req as CustomRequest).requestedBy;

			if (!currency || !amount) {
				res.status(400).json({
					message: 'Currency and amount are required',
				});
				return;
			}

			const result = await this.customerBalanceService.useBalance({
				customerId,
				currency,
				amount: Number(amount),
				category,
				quoteId,
				billingId,
				comments,
				createdBy: requestedBy,
			});

			res
				.status(result.status)
				.json({
					movement: result.movement,
					message: 'Saldo debitado con éxito',
				});
		} catch (error) {
			next(error);
		}
	};

	getMovements: Handler = async (req, res, next) => {
		try {
			const { customerId } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const pageSize = parseInt(req.query.pageSize as string) || 30;

			const filters = {
				currency: req.query.currency as 'COP' | 'USD' | undefined,
				type: req.query.type as 'CREDIT' | 'DEBIT',
				category: req.query.category as CustomerBalanceMovementCategory,
				dateStart: req.query.dateStart as string,
				dateEnd: req.query.dateEnd as string,
			};

			const result = await this.customerBalanceService.getMovements(
				customerId,
				page,
				pageSize,
				filters,
			);

			res.status(result.status).json(result.data);
		} catch (error) {
			next(error);
		}
	};
}
