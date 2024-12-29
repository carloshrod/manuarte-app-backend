import { Handler } from 'express';
import { ShopService } from './service';

export class ShopController {
	private shopService;

	constructor(shopService: ShopService) {
		this.shopService = shopService;
	}

	getAll: Handler = async (_req, res, next) => {
		try {
			const result = await this.shopService.getAll();
			if (result.status === 200) {
				res.status(result.status).json(result.shops);
				return;
			}

			res.sendStatus(result.status);
		} catch (error) {
			next(error);
		}
	};
}
