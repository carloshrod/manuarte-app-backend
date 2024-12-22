import { sequelize } from '../../config/database';
import { ProductCategoryModel } from '../product-category/model';
import { ProductModel } from '../product/model';
import { StockItemModel } from '../stock-item/model';
import { ProductVariantModel } from './model';
import { CreateProductVariantDto, UpdateProductVariantDto } from './types';

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
						[sequelize.col('product.productCategoryId'), 'productCategoryId'],
						[
							sequelize.col('product.productCategory.name'),
							'productCategoryName',
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
								as: 'productCategory',
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

	getProductVariantStockInfo = async (
		productVariantId: string,
		stockId: string,
	) => {
		try {
			const productVariantWithStockInfo =
				await this.productVariantModel.findByPk(productVariantId, {
					attributes: [
						'id',
						'name',
						[sequelize.col('product.name'), 'productName'],
						[sequelize.col('stockItems.price'), 'price'],
						[sequelize.col('stockItems.currency'), 'currency'],
					],
					include: [
						{
							model: this.productModel,
							as: 'product',
							attributes: [],
						},
						{
							model: StockItemModel,
							as: 'stockItems',
							where: { stockId },
							attributes: ['id', 'stockId'],
							through: { attributes: [] },
						},
					],
				});

			return { status: 200, productVariantWithStockInfo };
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	create = async ({
		name,
		productId,
		requestedBy,
	}: CreateProductVariantDto) => {
		try {
			const newProductVariant = this.productVariantModel.build({
				name,
				productId,
				createdBy: requestedBy,
				updatedBy: requestedBy,
			});

			await newProductVariant.generateVId();
			await newProductVariant.save();

			return newProductVariant.dataValues;
		} catch (error) {
			console.error('ServiceError creando presentación de producto: ', error);
			throw error;
		}
	};

	update = async ({ id, name, requestedBy }: UpdateProductVariantDto) => {
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
