import { Request, Response } from 'express';
import { ProductService } from './service';

export class ProductController {
	private productService;

	constructor(productService: ProductService) {
		this.productService = productService;
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
			const errorMsg =
				error instanceof Error ? error.message : 'Ocurrió un error!';
			res.status(500).json({ message: errorMsg });
		}
	};

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

			res.status(201).json(newProduct);
		} catch (error) {
			const errorMsg =
				error instanceof Error ? error.message : 'Ocurrió un error inesperado!';
			res.status(500).json({ message: errorMsg });
		}
	};
}
