import { Request, Response } from 'express';
import { ProductCategoryService } from './service';

export class ProductCategoryController {
	private productCategoryService;

	constructor() {
		this.productCategoryService = new ProductCategoryService();
	}

	getAll = async (_req: Request, res: Response) => {
		try {
			const categories = await this.productCategoryService.getAll();

			if (categories && categories.length > 0) {
				res.status(200).json(categories);
			} else {
				res.sendStatus(204);
			}
		} catch (error) {
			console.error(error);
		}
	};
}
