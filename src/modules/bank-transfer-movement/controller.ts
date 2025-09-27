import { Handler } from 'express';
import { BankTransferMovementService } from './service';

export class BankTransferMovementController {
	private bankTransferMovementService;

	constructor(bankTransferMovementService: BankTransferMovementService) {
		this.bankTransferMovementService = bankTransferMovementService;
	}

	getAllByShopId: Handler = async (req, res, next) => {
		try {
			const { shopId } = req.params;
			const date = (req.query.date as string) || undefined;

			const result = await this.bankTransferMovementService.getAllByDate(
				shopId,
				date,
			);

			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};
}
