import { sequelize } from '../../config/database';
import { ProductCategoryModel } from '../product-category/model';
import { ProductModel } from '../product/model';
import { ProductVariantModel } from './model';
import { ProductVariantAttr } from './types';

export class ProductVariantService {
	private productVariantModel;
	private productModel;
	private productCategoryModel;

	constructor(productVariantModel: typeof ProductVariantModel) {
		this.productVariantModel = productVariantModel;
		this.productModel = ProductModel;
		this.productCategoryModel = ProductCategoryModel;
	}

	getAll = async () => {
		try {
			const productVariants = await this.productVariantModel.findAll({
				attributes: {
					include: [
						[sequelize.col('product.name'), 'productName'],
						[sequelize.col('product.description'), 'productDescription'],
						[sequelize.col('product.categoryProduct.id'), 'categoryProductId'],
						[
							sequelize.col('product.categoryProduct.name'),
							'categoryProductName',
						],
					],
				},
				include: [
					{
						model: this.productModel,
						as: 'product',
						attributes: [],
						include: [
							{
								model: this.productCategoryModel,
								as: 'categoryProduct',
								attributes: [],
							},
						],
					},
				],
				order: [['productName', 'ASC']],
			});

			return productVariants;
		} catch (error) {
			console.error(
				'ServiceError obteniendo presentaciones de productos: ',
				error,
			);
			throw error;
		}
	};

	create = async (
		productVariantData: Partial<ProductVariantAttr>,
		submittedBy: string,
	) => {
		try {
			const newProductVariant = this.productVariantModel.build({
				...productVariantData,
				createdBy: submittedBy,
				updatedBy: submittedBy,
			});

			await newProductVariant.generateVId();
			await newProductVariant.save();

			return newProductVariant.dataValues;
		} catch (error) {
			console.error('ServiceError creando presentación de producto: ', error);
			throw error;
		}
	};

	update = async ({
		id,
		name,
		requestedBy,
	}: {
		id: string;
		name: string;
		requestedBy: string;
	}) => {
		try {
			const productVariantToUpdate =
				await this.productVariantModel.findByPk(id);
			if (!productVariantToUpdate) {
				throw new Error(
					`No se encontró la presentación de producto con id ${id}`,
				);
			}

			await productVariantToUpdate.update({
				name,
				updatedBy: requestedBy,
				updatedDate: sequelize.fn('now'),
			});

			return productVariantToUpdate.dataValues;
		} catch (error) {
			console.error(
				'ServiceError actualizando presentación de producto: ',
				error,
			);
			throw error;
		}
	};

	delete = async (productVariantId: string) => {
		try {
			const deletedCount = await this.productVariantModel.destroy({
				where: { id: productVariantId },
			});

			return deletedCount;
		} catch (error) {
			console.error(
				'ServiceError eliminando presentación del producto: ',
				error,
			);
			throw error;
		}
	};

	count = async (productId: string) => {
		try {
			const productVariantsCount = await this.productVariantModel.count({
				where: { productId },
			});

			return productVariantsCount;
		} catch (error) {
			console.error(
				'ServiceError en el conteo de presentaciones del producto: ',
				error,
			);
			throw error;
		}
	};
}
