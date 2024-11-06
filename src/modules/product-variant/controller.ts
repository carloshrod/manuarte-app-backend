import { Request, Response } from 'express';
import { ProductVariantService } from './service';

export class ProductVariantController {
	private productVariantService;

	constructor(productVariantService: ProductVariantService) {
		this.productVariantService = productVariantService;
	}

	getAll = async (_req: Request, res: Response) => {
		try {
			const productVariants = await this.productVariantService.getAll();

			if (productVariants.length > 0) {
				res.status(200).json(productVariants);
			} else {
				res.sendStatus(204);
			}
		} catch (error) {
			console.error(error);
			const errorMsg =
				error instanceof Error ? error.message : 'Ocurrió un error inesperado!';
			res.status(500).json({ message: errorMsg });
		}
	};
}
