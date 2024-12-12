import { sequelize } from '../../config/database';
import { ProductModel } from '../product/model';
import { ProductCategoryModel } from './model';
import { UpdateProductCategoryService } from './types';

export class ProductCategoryService {
	private productCategoryModel;
	private productModel;

	constructor(productCategoryModel: typeof ProductCategoryModel) {
		this.productCategoryModel = productCategoryModel;
		this.productModel = ProductModel;
	}

	create = async (name: string, requestedBy: string) => {
		try {
			const newProductCategory = this.productCategoryModel.build({
				name: name.toUpperCase(),
				createdBy: requestedBy,
				updatedBy: requestedBy,
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
			const { id, name, requestedBy } = data;
			const productCategoryToUpdate =
				await this.productCategoryModel.findByPk(id);
			if (!productCategoryToUpdate) {
				throw new Error(
					`No se encontró la categoría del producto con id ${id}`,
				);
			}

			await productCategoryToUpdate.update({
				name: name.toUpperCase(),
				updatedBy: requestedBy,
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
			const productsCount = await this.productModel.count({
				where: { categoryProductId: id },
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
			throw new Error('Error interno del servidor');
		}
	};
}
