import { sequelize } from '../../config/database';
import { ProductCategoryModel } from '../product-category/model';
import { ProductModel } from '../product/model';
import { ProductVariantServiceConstructor, ProductVariantAttr } from './types';

export class ProductVariantService {
	private productVariantModel;

	constructor(productVariantModel: ProductVariantServiceConstructor) {
		this.productVariantModel = productVariantModel;
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
						model: ProductModel,
						as: 'product',
						attributes: [],
						include: [
							{
								model: ProductCategoryModel,
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
			console.error(error);
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
			console.error('Error creando presentación de producto: ', error);
			throw error;
		}
	};

	update = async ({
		id,
		name,
		submittedBy,
	}: {
		id: string;
		name: string;
		submittedBy: string;
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
				updatedBy: submittedBy,
				updatedDate: sequelize.fn('now'),
			});

			return productVariantToUpdate.dataValues;
		} catch (error) {
			console.error('Error actualizando presentación de producto: ', error);
			throw error;
		}
	};
}
