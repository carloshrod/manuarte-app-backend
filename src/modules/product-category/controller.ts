import { Handler } from 'express';
import { ProductCategoryService } from './service';

export class ProductCategoryController {
	private productCategoryService;

	constructor(productCategoryService: ProductCategoryService) {
		this.productCategoryService = productCategoryService;
	}

	create: Handler = async (req, res, next) => {
		try {
			const { name } = req.body;
			// ToDo: Obtener el id del usuario que crea el producto
			const submittedBy = '13503e37-f230-4471-965b-312ae136a484';
			const newProductCategory = await this.productCategoryService.create(
				name,
				submittedBy,
			);

			res.status(201).json({
				newProductCategory,
				message: 'Categoría de producto creada con éxito',
			});
		} catch (error) {
			next(error);
		}
	};

	getAll: Handler = async (_req, res, next) => {
		try {
			const categories = await this.productCategoryService.getAll();

			if (categories && categories.length > 0) {
				res.status(200).json(categories);
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
			const submittedBy = '13503e37-f230-4471-965b-312ae136a484';

			const updatedProductCategory = await this.productCategoryService.update({
				id,
				name,
				submittedBy,
			});

			res.status(200).json({
				updatedProductCategory,
				message: 'Categoría de producto actualizada con éxito',
			});
		} catch (error) {
			next(error);
		}
	};

	delete: Handler = async (req, res, next) => {
		try {
			const { id } = req.params;

			const result = await this.productCategoryService.delete(id);

			if (!result?.success) {
				res.status(400).json({ message: result?.message });
			} else {
				res.status(200).json({
					message: 'La categoría de producto fue eliminada con éxito',
				});
			}
		} catch (error) {
			next(error);
		}
	};
}
