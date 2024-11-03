import { Request, Response } from 'express';
import { ProductService } from './service';

export class ProductController {
	private productService;

	constructor() {
		this.productService = new ProductService();
	}

	getAll = async (_req: Request, res: Response) => {
		try {
			const products = await this.productService.getAll();

			if (products.length > 0) {
				res.status(200).json(products);
			} else {
				res.sendStatus(204);
			}
		} catch (error) {
			console.error(error);
		}
	};
}
