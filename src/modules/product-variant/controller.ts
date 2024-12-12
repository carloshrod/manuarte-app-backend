import { ProductVariantService } from './service';
import { Handler } from 'express';
import { CustomRequest } from '../types';

export class ProductVariantController {
	private productVariantService;

	constructor(productVariantService: ProductVariantService) {
		this.productVariantService = productVariantService;
	}

	getAll: Handler = async (_req, res, next) => {
		try {
			const productVariants = await this.productVariantService.getAll();

			if (productVariants.length > 0) {
				res.status(200).json(productVariants);
			} else {
				res.sendStatus(204);
			}
		} catch (error) {
			next(error);
		}
	};

	update: Handler = async (req, res, next) => {
		try {
			const { id } = req.params;
			const { name } = req.body;
			const requestedBy = (req as CustomRequest).requestedBy;

			await this.productVariantService.update({
				id,
				name,
				requestedBy,
			});

			res.status(200).json({
				message: 'Presentación del producto actualizada con éxito',
			});
		} catch (error) {
			next(error);
		}
	};
}
