import {
	ProductCreateService,
	ProductServiceConstructor,
	ProductUpdateService,
} from './types';
import { sequelize } from '../../config/database';

export class ProductService {
	private productModel;
	private productVariantService;
	private productCategoryService;

	constructor({
		productModel,
		productVariantService,
		productCategoryService,
	}: ProductServiceConstructor) {
		this.productModel = productModel;
		this.productVariantService = productVariantService;
		this.productCategoryService = productCategoryService;
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
			const newProduct = this.productModel.build({
				...productData,
				createdBy: submittedBy,
				updatedBy: submittedBy,
			});

			await newProduct.generatePId();
			await newProduct.save();

			const newProductVariants = [];
			if (productVariants?.length > 0) {
				for (const name of productVariants) {
					const newProductVariant = await this.productVariantService.create(
						{
							name,
							productId: newProduct.id,
						},
						submittedBy,
					);

					newProductVariants.push(newProductVariant);
				}
			}

			const categoryName = await this.productCategoryService.getName(
				newProduct?.categoryProductId,
			);

			return {
				...newProduct.dataValues,
				categoryProductName: categoryName,
				productVariants: newProductVariants,
			};
		} catch (error) {
			console.error('Error creando producto: ', error);
			throw error;
		}
	};

	update = async ({
		id,
		productData,
		productVariantData,
		submittedBy,
	}: ProductUpdateService) => {
		try {
			const productToUpdate = await this.productModel.findByPk(id);
			if (!productToUpdate)
				throw new Error(`No se encontró el producto con id ${id}`);

			await productToUpdate.update({
				...productData,
				updatedBy: submittedBy,
				updatedDate: sequelize.fn('now'),
			});

			await this.productVariantService.update({
				id: productVariantData.id,
				name: productVariantData.name,
				submittedBy,
			});
		} catch (error) {
			console.error('Error actualizando producto: ', error);
			throw error;
		}
	};
}
