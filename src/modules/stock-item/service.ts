import { StockItemModel } from './model';
import { ProductVariantModel } from '../product-variant/model';
import { sequelize } from '../../config/database';
import { ShopModel } from '../shop/model';
import { ProductModel } from '../product/model';
import { ShopService } from '../shop/service';
import { CreateStockItemDto } from './types';

export class StockItemService {
	private stockItemModel;
	private shopService;

	constructor(stockItemModel: typeof StockItemModel) {
		this.stockItemModel = stockItemModel;
		this.shopService = new ShopService(ShopModel);
	}

	getAll = async (shopSlug: string) => {
		try {
			const shop = await this.shopService.getOneBySlug(shopSlug);
			if (!shop) {
				return { status: 400, message: 'Tienda no encontrada' };
			}

			const stockItems = await this.stockItemModel.findAll({
				where: { stockId: shop.dataValues?.stockId },
				attributes: [
					'id',
					[sequelize.col('productVariants.product.name'), 'productName'],
					[sequelize.col('productVariants.name'), 'productVariantName'],
					[sequelize.col('productVariants.id'), 'productVariantId'],
					'currency',
					'price',
					'quantity',
					'cost',
					'updatedDate',
				],
				include: [
					{
						model: ProductVariantModel,
						as: 'productVariants',
						attributes: [],
						required: true,
						through: { attributes: [] },
						include: [
							{
								model: ProductModel,
								as: 'product',
								attributes: [],
								required: true,
							},
						],
					},
				],
				order: [['updatedDate', 'DESC']],
			});

			return { status: 200, stockItems };
		} catch (error) {
			console.error('Error getting stock items');
			throw error;
		}
	};

	getOne = async (productVariantId: string, stockId: string) => {
		try {
			const stockItem = await this.stockItemModel.findOne({
				where: { stockId },
				attributes: ['id', 'quantity'],
				include: [
					{
						model: ProductVariantModel,
						as: 'productVariants',
						where: { id: productVariantId },
						attributes: [],
						through: { attributes: [] },
					},
				],
			});

			return stockItem;
		} catch (error) {
			console.error('Error obteniendo item de stock');
			throw error;
		}
	};

	getOneById = async (id: string) => {
		try {
			const stockItem = await StockItemModel.findByPk(id, {
				attributes: [
					'id',
					'quantity',
					[sequelize.col('productVariants.name'), 'productVariantName'],
					[sequelize.col('productVariants.product.name'), 'productName'],
				],
				include: [
					{
						model: ProductVariantModel,
						as: 'productVariants',
						attributes: [],
						include: [
							{
								model: ProductModel,
								as: 'product',
								attributes: [],
							},
						],
					},
				],
			});

			return stockItem;
		} catch (error) {
			console.error('Error obteniendo item de stock por id');
			throw error;
		}
	};

	create = async (stockItemData: CreateStockItemDto) => {
		const transaction = await sequelize.transaction();
		try {
			const { shopSlug, productVariantId, ...stockItemRest } = stockItemData;
			const shop = await this.shopService.getOneBySlug(shopSlug);
			if (!shop) {
				return { status: 400, message: 'Tienda no encontrada' };
			}

			const newStockItem = await this.stockItemModel.create(
				{
					...stockItemRest,
					stockId: shop?.dataValues?.stockId,
					currency: shop?.currency,
					quantity: shop?.dataValues?.mainStock ? stockItemRest?.quantity : 0,
				},
				{ transaction },
			);
			if (!newStockItem) {
				throw new Error('Falló la creación del stock de producto');
			}

			const productVariant = await ProductVariantModel.findByPk(
				productVariantId,
				{
					attributes: [
						'id',
						'name',
						[sequelize.col('product.name'), 'productName'],
					],
					include: [
						{
							model: ProductModel,
							as: 'product',
							attributes: [],
						},
					],
				},
			);

			if (!productVariant) {
				throw new Error('El ProductVariant con el ID proporcionado no existe');
			}

			await newStockItem.addProductVariant(productVariantId, { transaction });

			await transaction.commit();

			return {
				status: 201,
				newStockItem: {
					...newStockItem.dataValues,
					productName: productVariant?.dataValues.productName,
					productVariantName: productVariant?.dataValues.name,
					productVariantId: productVariant?.dataValues.id,
				},
			};
		} catch (error) {
			await transaction.rollback();
			console.error('Error creating stock item');
			throw error;
		}
	};

	update = async (stockItemData: CreateStockItemDto, id: string) => {
		try {
			const { shopSlug, productVariantId, ...stockItemRest } = stockItemData;

			const stockItemToUpdate = await this.stockItemModel.findByPk(id);
			if (!stockItemToUpdate) {
				throw new Error('Stock de producto no encontrado');
			}

			const shop = await this.shopService.getOneBySlug(shopSlug);
			if (!shop) {
				return { status: 400, message: 'Tienda no encontrada' };
			}

			await stockItemToUpdate.update({
				...stockItemRest,
				quantity: shop?.dataValues?.mainStock ? stockItemRest?.quantity : 0,
			});

			const productVariant = await ProductVariantModel.findByPk(
				productVariantId,
				{
					attributes: [
						'id',
						'name',
						[sequelize.col('product.name'), 'productName'],
					],
					include: [
						{
							model: ProductModel,
							as: 'product',
							attributes: [],
						},
					],
				},
			);

			if (!productVariant) {
				throw new Error('El ProductVariant con el ID proporcionado no existe');
			}

			return {
				status: 200,
				updatedStockItem: {
					...stockItemToUpdate.dataValues,
					productName: productVariant?.dataValues.productName,
					productVariantName: productVariant?.dataValues.name,
					productVariantId: productVariant?.dataValues.id,
				},
			};
		} catch (error) {
			console.error('Error updating stock item');
			throw error;
		}
	};

	delete = async (id: string) => {
		try {
			const result = await this.stockItemModel.destroy({ where: { id } });

			if (result === 1) {
				return {
					status: 200,
					message: 'Stock de producto eliminado con éxito',
				};
			}

			return { status: 404, message: 'Stock de producto no encontrado' };
		} catch (error) {
			console.error('Error deleting stock item');
			throw error;
		}
	};
}
