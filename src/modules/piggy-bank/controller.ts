import { Handler } from 'express';
import { CustomRequest } from '../types';
import { PiggyBankMovementService } from './service';

export class PiggyBankMovementController {
	private piggyBankMovementService;

	constructor(piggyBankMovementService: PiggyBankMovementService) {
		this.piggyBankMovementService = piggyBankMovementService;
	}

	withDraw: Handler = async (req, res, next) => {
		try {
			const { shopId } = req.params;
			const { amount, comments } = req.body;
			const createdBy = (req as CustomRequest).requestedBy;

			const currentSessionUpdated =
				await this.piggyBankMovementService.withDraw({
					shopId,
					amount,
					comments,
					createdBy,
				});

			res.status(200).json({
				message: 'Retiro realizado con éxito',
				currentSessionUpdated,
			});
		} catch (error) {
			next(error);
		}
	};
}
