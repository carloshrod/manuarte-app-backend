import { Handler } from 'express';
import { CustomRequest } from '../types';
import { CashMovementService } from './service';

export class CashMovementController {
	private cashMovementService;

	constructor(cashMovementService: CashMovementService) {
		this.cashMovementService = cashMovementService;
	}

	createMovement: Handler = async (req, res, next) => {
		try {
			const { shopId } = req.params;
			const { amount, type, category, comments, billingPaymentId } = req.body;
			const createdBy = (req as CustomRequest).requestedBy;

			const { newCashMovement, newBalance } =
				await this.cashMovementService.create({
					shopId,
					type,
					category,
					amount,
					comments,
					billingPaymentId,
					createdBy,
				});

			res.status(200).json({
				message: 'Movimiento creado con éxito',
				newCashMovement,
				newBalance,
			});
		} catch (error) {
			next(error);
		}
	};
}
