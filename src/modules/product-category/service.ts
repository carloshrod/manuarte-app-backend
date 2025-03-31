import { sequelize } from '../../config/database';
import { ProductCategoryGroupModel } from '../product-category-group/model';
import { ProductModel } from '../product/model';
import { ProductCategoryModel } from './model';
import { CreateProductCategoryDto, UpdateProductCategoryDto } from './types';

export class ProductCategoryService {
	private productCategoryModel;
	private productModel;

	constructor(productCategoryModel: typeof ProductCategoryModel) {
		this.productCategoryModel = productCategoryModel;
		this.productModel = ProductModel;
	}

	getAll = async () => {
		try {
			const categories = await this.productCategoryModel.findAll({
				attributes: {
					include: [[sequelize.col('productCategoryGroup.name'), 'groupName']],
				},
				include: [
					{
						model: ProductCategoryGroupModel,
						as: 'productCategoryGroup',
						attributes: [],
					},
				],
				order: [['cId', 'ASC']],
			});

			return categories;
		} catch (error) {
			console.error('ServiceError obteniendo categorías de producto: ', error);
			throw error;
		}
	};

	create = async ({ name, requestedBy }: CreateProductCategoryDto) => {
		try {
			const newProductCategory = this.productCategoryModel.build({
				name,
				createdBy: requestedBy,
				updatedBy: requestedBy,
			});

			await newProductCategory.generateCId();

			await newProductCategory.save();

			return newProductCategory.dataValues;
		} catch (error) {
			console.error('ServiceError creando categoría de producto: ', error);
			throw error;
		}
	};

	update = async ({ id, name, requestedBy }: UpdateProductCategoryDto) => {
		try {
			const productCategoryToUpdate =
				await this.productCategoryModel.findByPk(id);
			if (!productCategoryToUpdate) {
				throw new Error(
					`No se encontró la categoría del producto con id ${id}`,
				);
			}

			await productCategoryToUpdate.update({
				name,
				updatedBy: requestedBy,
			});

			return productCategoryToUpdate.dataValues;
		} catch (error) {
			console.error('ServiceError actualizando categoría de producto: ', error);
			throw error;
		}
	};

	delete = async (id: string) => {
		try {
			const productsCount = await this.productModel.count({
				where: { productCategoryId: id },
			});

			if (productsCount > 0) {
				return {
					success: false,
					message:
						'No se puede eliminar la categoría, porque tiene productos asociados',
				};
			}

			await this.productCategoryModel.destroy({
				where: { id },
			});

			return {
				success: true,
				message: 'La categoría de producto fue eliminada con éxito',
			};
		} catch (error) {
			console.error('ServiceError eliminando categoría de producto: ', error);
			throw error;
		}
	};
}
