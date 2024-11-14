import { col, fn } from 'sequelize';
import { sequelize } from '../../config/database';
import { ProductModel } from '../product/model';
import { ProductCategoryModel } from './model';
import { UpdateProductCategoryService } from './types';

export class ProductCategoryService {
	private productCategoryModel;

	constructor(productCategoryModel: typeof ProductCategoryModel) {
		this.productCategoryModel = productCategoryModel;
	}

	create = async (name: string, submittedBy: string) => {
		try {
			const newProductCategory = this.productCategoryModel.build({
				name: name.toUpperCase(),
				createdBy: submittedBy,
				updatedBy: submittedBy,
			});

			await newProductCategory.generateCId();

			await newProductCategory.save();

			return newProductCategory.dataValues;
		} catch (error) {
			console.error('ServiceError creando categoría de producto: ', error);
			throw new Error('Error interno del servidor');
		}
	};

	getAll = async () => {
		try {
			const categories = await this.productCategoryModel.findAll();

			return categories;
		} catch (error) {
			console.error('ServiceError obteniendo categorías de producto: ', error);
			throw new Error('Error interno del servidor');
		}
	};

	update = async (data: UpdateProductCategoryService) => {
		try {
			const { id, name, submittedBy } = data;
			const productCategoryToUpdate =
				await this.productCategoryModel.findByPk(id);
			if (!productCategoryToUpdate) {
				throw new Error(
					`No se encontró la categoría del producto con id ${id}`,
				);
			}

			await productCategoryToUpdate.update({
				name: name.toUpperCase(),
				updatedBy: submittedBy,
				updatedDate: sequelize.fn('now'),
			});

			return productCategoryToUpdate.dataValues;
		} catch (error) {
			console.error('ServiceError actualizando categoría de producto: ', error);
			throw new Error('Error interno del servidor');
		}
	};

	delete = async (id: string) => {
		try {
			const productsCount = await this.countProducts(id);

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
			throw new Error('Error interno del servidor');
		}
	};

	getName = async (id: string) => {
		try {
			const category = await this.productCategoryModel.findByPk(id, {
				attributes: ['name'],
			});

			if (!category) throw new Error('Categoría no encontrada');

			return category.name;
		} catch (error) {
			console.error('ServiceError obteniendo nombre de la categoría: ', error);
			throw new Error('Error interno del servidor');
		}
	};

	private countProducts = async (id: string) => {
		try {
			const result = await this.productCategoryModel.findByPk(id, {
				attributes: [[fn('COUNT', col('products.id')), 'productCount']],
				include: [
					{
						model: ProductModel,
						as: 'products',
						attributes: [],
					},
				],
				group: ['ProductCategoryModel.id'],
			});

			return Number(result?.dataValues.productCount);
		} catch (error) {
			console.error(
				'ServiceError en el conteo de productos de la categoría: ',
				error,
			);
			throw new Error('Error interno del servidor');
		}
	};
}
