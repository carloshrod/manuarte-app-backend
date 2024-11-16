import { Handler } from 'express';
import { ProductVariantService } from './service';

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
			// ToDo: Obtener el id del usuario que actualiza el producto
			const submittedBy = '13503e37-f230-4471-965b-312ae136a484';

			await this.productVariantService.update({
				id,
				name,
				submittedBy,
			});

			res.status(200).json({
				message: 'Presentación del producto actualizada con éxito',
			});
		} catch (error) {
			next(error);
		}
	};
}
