import { StockItemModel } from './model';
import { ProductVariantModel } from '../product-variant/model';
import { sequelize } from '../../config/database';
import { ShopModel } from '../shop/model';
import { ProductModel } from '../product/model';
import { ShopService } from '../shop/service';
import {
	CreateStockItemDto,
	PartialStockItem,
	UpdateStockItemDto,
} from './types';
import { Transaction } from 'sequelize';

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
					[sequelize.col('productVariants.vId'), 'vId'],
					'currency',
					'price',
					'quantity',
					'cost',
					'minQty',
					'maxQty',
					'updatedDate',
				],
				include: [
					{
						model: ProductVariantModel,
						as: 'productVariants',
						attributes: [],
						where: { deletedDate: null },
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
				order: [['productName', 'ASC']],
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

	getOneById = async (id: string, transaction?: Transaction) => {
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
				transaction,
			});

			return stockItem;
		} catch (error) {
			console.error('Error obteniendo item de stock por id');
			throw error;
		}
	};

	createMultiple = async (
		productVariantId: string,
		stockItemData: PartialStockItem,
		stocks: { id: string; currency: 'COP' | 'USD' }[],
		transaction: Transaction,
	) => {
		try {
			const { priceCop, costCop, priceUsd, costUsd, ...rest } = stockItemData;

			for (const stock of stocks) {
				await this.create(
					{
						productVariantId,
						stockId: stock.id,
						currency: stock.currency,
						price: stock.currency === 'COP' ? priceCop : priceUsd,
						cost: stock.currency === 'COP' ? costCop : costUsd,
						...rest,
					},
					transaction,
				);
			}

			return { status: 201 };
		} catch (error) {
			console.error('Error creating stock items');
			throw error;
		}
	};

	create = async (
		stockItemData: CreateStockItemDto,
		externalTransaction?: Transaction,
	) => {
		const transaction = externalTransaction ?? (await sequelize.transaction());
		try {
			const { productVariantId, ...stockItemRest } = stockItemData;

			const newStockItem = await this.stockItemModel.create(
				{ ...stockItemRest },
				{ transaction },
			);

			const productVariant = await this.getProductAttrs(
				productVariantId,
				transaction,
			);

			await newStockItem.addProductVariant(productVariantId, {
				transaction,
			});

			if (!externalTransaction) {
				await transaction.commit();
			}

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
			if (!externalTransaction) {
				await transaction.rollback();
			}
			console.error('Error creating stock item');
			throw error;
		}
	};

	update = async ({ id, stockItemData }: UpdateStockItemDto) => {
		try {
			const { productVariantId, ...stockItemRest } = stockItemData;

			const stockItemToUpdate = await this.stockItemModel.findByPk(id);
			if (!stockItemToUpdate) {
				throw new Error('Stock de producto no encontrado');
			}

			await stockItemToUpdate.update({ ...stockItemRest });

			const productVariant = await this.getProductAttrs(productVariantId);

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

	private getProductAttrs = async (
		productVariantId: string,
		transaction?: Transaction,
	) => {
		try {
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
					transaction,
				},
			);

			if (!productVariant) {
				throw new Error(
					'La presentación de producto con el ID proporcionado no existe',
				);
			}

			return productVariant;
		} catch (error) {
			console.error('Error getting product info');
			throw error;
		}
	};
}
