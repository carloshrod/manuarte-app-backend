import { ProductService } from './service';
import { Handler } from 'express';
import { CustomRequest } from '../types';

export class ProductController {
	private productService;

	constructor(productService: ProductService) {
		this.productService = productService;
	}

	create: Handler = async (req, res, next) => {
		try {
			const { productVariants, ...rest } = req.body;
			const requestedBy = (req as CustomRequest).requestedBy;

			const newProduct = await this.productService.create({
				productData: rest,
				productVariants,
				requestedBy,
			});

			res
				.status(201)
				.json({ newProduct, message: 'Producto agregado con éxito' });
		} catch (error) {
			next(error);
		}
	};

	getAll: Handler = async (_req, res, next) => {
		try {
			const products = await this.productService.getAll();

			if (products.length > 0) {
				res.status(200).json(products);
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
			const { productVariant, ...rest } = req.body;
			const requestedBy = (req as CustomRequest).requestedBy;

			await this.productService.update({
				id,
				productData: { ...rest },
				productVariantData: productVariant,
				requestedBy,
			});

			res.status(200).json({ message: 'Producto actualizado con éxito' });
		} catch (error) {
			next(error);
		}
	};

	addVariant: Handler = async (req, res, next) => {
		try {
			const { id } = req.params;
			const requestedBy = (req as CustomRequest).requestedBy;

			const newProductVariant = await this.productService.addVariant({
				productId: id,
				name: req.body.name,
				requestedBy,
			});

			res.status(201).json({
				newProductVariant,
				message: 'Presentación del producto creada con éxito',
			});
		} catch (error) {
			next(error);
		}
	};

	delete: Handler = async (req, res, next) => {
		try {
			const productId = (req.query.productId as string) || '';
			const productVariantId = (req.query.productVariantId as string) || '';

			const result = await this.productService.delete(
				productId,
				productVariantId,
			);

			const productDeleted = result.productDeleted === 1;

			res.status(200).json({
				productDeleted,
				message: productDeleted
					? 'Producto y su presentación eliminados con éxito'
					: 'Presentación del producto eliminada con éxito',
			});
		} catch (error) {
			next(error);
		}
	};
}
