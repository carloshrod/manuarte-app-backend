import { ProductModel } from './model';
import { ProductCreateService } from './types';
import { ProductVariantService } from '../product-variant/service';
import { CustomCreateOptions } from '../types';

export class ProductService {
	private productModel;
	private productVariantService;

	constructor(
		productModel: typeof ProductModel,
		productVariantService: ProductVariantService,
	) {
		this.productModel = productModel;
		this.productVariantService = productVariantService;
	}

	getAll = async () => {
		try {
			const products = await this.productModel.findAll({
				attributes: ['id', 'name'],
			});

			return products;
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	create = async ({
		productData,
		productVariants,
		submittedBy,
	}: ProductCreateService) => {
		try {
			const newProduct = await this.productModel.create(productData, {
				submittedBy,
			} as CustomCreateOptions);

			const newProductVariants = [];
			if (productVariants?.length > 0) {
				for (const productVariantName of productVariants) {
					const newProductVariant = await this.productVariantService.create({
						productVariantName,
						productData: newProduct,
						submittedBy,
					});

					newProductVariants.push(newProductVariant);
				}
			}

			return { newProduct, newProductVariants };
		} catch (error) {
			console.error('Error creando producto: ', error);
			throw error;
		}
	};
}
