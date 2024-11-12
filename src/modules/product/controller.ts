import { Request, Response } from 'express';
import { ProductService } from './service';

export class ProductController {
	private productService;

	constructor(productService: ProductService) {
		this.productService = productService;
	}

	create = async (req: Request, res: Response) => {
		try {
			const { productVariants, ...rest } = req.body;
			// ToDo: Obtener el id del usuario que crea el producto
			const submittedBy = '13503e37-f230-4471-965b-312ae136a484';

			const newProduct = await this.productService.create({
				productData: rest,
				productVariants,
				submittedBy,
			});

			res
				.status(201)
				.json({ newProduct, message: 'Producto agregado con éxito' });
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : 'Ocurrió un error inesperado';
			res.status(500).json({ message: errorMsg });
		}
	};

	getAll = async (_req: Request, res: Response) => {
		try {
			const products = await this.productService.getAll();

			if (products.length > 0) {
				res.status(200).json(products);
			} else {
				res.sendStatus(204);
			}
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : 'Ocurrió un error!';
			res.status(500).json({ message: errorMsg });
		}
	};

	update = async (req: Request, res: Response) => {
		try {
			const { id } = req.params;
			const { productVariant, ...rest } = req.body;
			// ToDo: Obtener el id del usuario que actualiza el producto
			const submittedBy = '13503e37-f230-4471-965b-312ae136a484';

			await this.productService.update({
				id,
				productData: { ...rest },
				productVariantData: productVariant,
				submittedBy,
			});

			res.status(200).json({ message: 'Producto actualizado con éxito' });
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : 'Ocurrió un error inesperado';
			res.status(500).json({ message: errorMsg });
		}
	};

	addVariant = async (req: Request, res: Response) => {
		try {
			const { id } = req.params;
			const submittedBy = '13503e37-f230-4471-965b-312ae136a484';

			const newProductVariant = await this.productService.addVariant({
				productId: id,
				name: req.body.name,
				submittedBy,
			});

			res.status(201).json({
				newProductVariant,
				message: 'Presentación del producto creada con éxito',
			});
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : 'Ocurrió un error inesperado';
			res.status(500).json({ message: errorMsg });
		}
	};

	delete = async (req: Request, res: Response) => {
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
			const errorMsg =
				error instanceof Error ? error.message : 'Ocurrió un error inesperado';
			res.status(500).json({ message: errorMsg });
		}
	};

	searchProducts = async (req: Request, res: Response) => {
		try {
			const productName = (req.query.productName as string) || '';
			const products = await this.productService.getProductsByName(productName);

			res.status(200).json(products);
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : 'Ocurrió un error inesperado';
			res.status(500).json({ message: errorMsg });
		}
	};
}
