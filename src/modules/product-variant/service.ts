import { sequelize } from '../../config/database';
import { ProductCategoryModel } from '../product-category/model';
import { ProductModel } from '../product/model';
import { StockItemModel } from '../stock-item/model';
import { ProductVariantModel } from './model';
import {
	CreateProductVariantDto,
	ProductVariantFilters,
	UpdateProductVariantDto,
} from './types';
import { Op, Transaction } from 'sequelize';

export class ProductVariantService {
	private productVariantModel;
	private productModel;
	private productCategoryModel;

	constructor(productVariantModel: typeof ProductVariantModel) {
		this.productVariantModel = productVariantModel;
		this.productModel = ProductModel;
		this.productCategoryModel = ProductCategoryModel;
	}

	getAll = async (
		page: number = 1,
		pageSize: number = 30,
		filters: ProductVariantFilters = {},
	) => {
		try {
			const offset = (page - 1) * pageSize;

			const productVariantWhere: Record<string, unknown> = {};
			if (filters.vId) {
				productVariantWhere.vId = { [Op.iLike]: `%${filters.vId}%` };
			}
			if (filters.variantName) {
				productVariantWhere.name = { [Op.iLike]: `%${filters.variantName}%` };
			}

			const productWhere: Record<string, unknown> = { deletedDate: null };
			if (filters.productName) {
				productWhere.name = { [Op.iLike]: `%${filters.productName}%` };
			}
			if (filters.productDescription) {
				productWhere.description = {
					[Op.iLike]: `%${filters.productDescription}%`,
				};
			}

			const productCategoryWhere: Record<string, unknown> = {};
			if (filters.productCategoryName) {
				productCategoryWhere.name = {
					[Op.iLike]: `%${filters.productCategoryName}%`,
				};
			}

			const { rows: productVariants, count: total } =
				await this.productVariantModel.findAndCountAll({
					where: {
						active: filters?.showActiveOnly ?? true,
						...productVariantWhere,
					},
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
							where: Object.keys(productWhere).length
								? productWhere
								: undefined,
							include: [
								{
									model: this.productCategoryModel,
									as: 'productCategory',
									required: true,
									attributes: [],
									where: Object.keys(productCategoryWhere).length
										? productCategoryWhere
										: undefined,
								},
							],
						},
					],
					order: [['productName', 'ASC']],
					limit: pageSize,
					offset,
				});

			return {
				productVariants,
				total,
				page,
				pageSize,
				totalPages: Math.ceil(total / pageSize),
			};
		} catch (error) {
			console.error(
				'ServiceError obteniendo presentaciones de productos: ',
				error,
			);
			throw error;
		}
	};

	create = async (
		{ name, productId, requestedBy }: CreateProductVariantDto,
		transaction: Transaction,
	) => {
		try {
			const newProductVariant = this.productVariantModel.build({
				name,
				productId,
				createdBy: requestedBy,
				updatedBy: requestedBy,
			});

			await newProductVariant.generateVId(transaction);
			await newProductVariant.save({ transaction });

			return newProductVariant.dataValues;
		} catch (error) {
			console.error('ServiceError creando presentación de producto: ', error);
			throw error;
		}
	};

	update = async ({
		id,
		name,
		active,
		requestedBy,
	}: UpdateProductVariantDto) => {
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
				active,
				updatedBy: requestedBy,
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
			const productVariantToDelete =
				await this.productVariantModel.findByPk(productVariantId);
			if (!productVariantToDelete)
				throw new Error(
					'No se encontró la presentación del producto que intentas eliminar',
				);

			await productVariantToDelete.destroy();

			return productVariantToDelete;
		} catch (error) {
			console.error(
				'ServiceError eliminando presentación del producto: ',
				error,
			);
			throw error;
		}
	};

	searchByNameOrCode = async (
		stockId: string,
		search: string,
		missingProducts: boolean,
	) => {
		try {
			const productVariants = missingProducts
				? await this.getMissing(search, stockId)
				: await this.getWithStockInfo(search, stockId);

			return { status: 200, productVariants };
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	bulkSearch = async (productVariantCodes: string[], stockId: string) => {
		try {
			const productVariantsWithStockInfo = await Promise.all(
				productVariantCodes.map(async pvCode => {
					try {
						const productVariant = await this.productVariantModel.findOne({
							where: { vId: pvCode },
							attributes: [
								'id',
								'name',
								[sequelize.col('product.name'), 'productName'],
								[sequelize.col('stockItems.id'), 'stockItemId'],
								[sequelize.col('stockItems.quantity'), 'quantity'],
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
									attributes: [],
									through: { attributes: [] },
								},
							],
						});

						if (!productVariant) {
							const missingProductInStock =
								await this.productVariantModel.findOne({
									where: { vId: pvCode },
									attributes: [
										'name',
										[sequelize.col('product.name'), 'productName'],
									],
									include: [
										{
											model: this.productModel,
											as: 'product',
											attributes: [],
										},
									],
								});
							if (!missingProductInStock) {
								throw new Error(
									`No existe el producto con código ${pvCode}. Por favor revisa bien los datos e intentalo nuevamente!`,
								);
							}
							const { name, productName } = missingProductInStock.dataValues;

							throw new Error(
								`No fue posible encontrar en la bodega el item ${productName} - ${name}. Por favor revisa bien los datos e intentalo nuevamente!`,
							);
						}

						if (!productVariant || !productVariant.dataValues) {
							throw new Error(
								`No se pudo obtener los datos del producto con código ${pvCode}.`,
							);
						}
						const { productName, name, ...rest } = productVariant.dataValues;

						return {
							...rest,
							name: `${productName} - ${name}`,
							productCode: pvCode,
						};
					} catch (error) {
						console.error(`Error interno con el código ${pvCode}:`, error);
						throw error;
					}
				}),
			);

			const productVariantsResult = await Promise.all(
				productVariantsWithStockInfo.map(async productVariant => {
					if (productVariant) {
						const stockItems = await StockItemModel.findAll({
							include: [
								{
									model: this.productVariantModel,
									as: 'productVariants',
									where: { id: productVariant.id },
									through: { attributes: [] },
								},
							],
						});

						return {
							...productVariant,
							stocks: stockItems.map(item => item.dataValues.stockId),
						};
					}
				}),
			);

			return { status: 200, productVariants: productVariantsResult };
		} catch (error) {
			console.error('Error obteniendo productos con información de stock');
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

	private getWithStockInfo = async (search: string, stockId?: string) => {
		try {
			const productVariantsWithStockInfo =
				await this.productVariantModel.findAll({
					where: {
						[Op.or]: [
							{ vId: { [Op.iLike]: `%${search}%` } },
							sequelize.where(
								sequelize.literal(
									`concat("product"."name", ' ', "ProductVariantModel"."name")`,
								),
								{ [Op.iLike]: `%${search}%` },
							),
						],
					},
					attributes: [
						'id',
						'name',
						[sequelize.col('product.name'), 'productName'],
						[sequelize.col('stockItems.id'), 'stockItemId'],
						[sequelize.col('stockItems.quantity'), 'quantity'],
						[sequelize.col('stockItems.price'), 'price'],
						[sequelize.col('stockItems.currency'), 'currency'],
					],
					include: [
						{
							model: this.productModel,
							as: 'product',
							attributes: [],
							where: { deletedDate: null },
						},
						{
							model: StockItemModel,
							as: 'stockItems',
							where: { stockId },
							attributes: [],
							through: { attributes: [] },
						},
					],
					order: [[sequelize.col('stockItems.quantity'), 'DESC']],
				});

			const productVariantsResult = [];
			for (const productVariant of productVariantsWithStockInfo) {
				const stockItems = await StockItemModel.findAll({
					include: [
						{
							model: this.productVariantModel,
							as: 'productVariants',
							where: { id: productVariant.dataValues.id },
							through: { attributes: [] },
						},
					],
				});
				productVariantsResult.push({
					...productVariant.dataValues,
					stocks: stockItems.map(item => item.dataValues.stockId),
				});
			}

			return productVariantsResult;
		} catch (error) {
			console.error('Error obteniendo productos con información de stock');
			throw error;
		}
	};

	private getMissing = async (search: string, stockId: string) => {
		try {
			const missingProductVariants = await this.productVariantModel.findAll({
				where: {
					[Op.or]: [
						{ vId: { [Op.iLike]: `%${search}%` } },
						sequelize.where(
							sequelize.literal(
								`concat("product"."name", ' ', "ProductVariantModel"."name")`,
							),
							{ [Op.iLike]: `%${search}%` },
						),
					],
					id: {
						[Op.notIn]: sequelize.literal(`(
						SELECT sipv."productVariantId"
						FROM "stock_item_product_variant" AS sipv
						INNER JOIN "stock_item" AS si ON si."id" = sipv."stockItemId"
						WHERE si."stockId" = '${stockId}'
					)`),
					},
				},
				attributes: [
					'id',
					'name',
					[sequelize.col('product.name'), 'productName'],
				],
				include: [
					{
						model: this.productModel,
						as: 'product',
						attributes: [],
						where: { deletedDate: null },
					},
				],
			});

			return missingProductVariants;
		} catch (error) {
			console.error('Error obteniendo productos faltantes');
			throw error;
		}
	};
}
