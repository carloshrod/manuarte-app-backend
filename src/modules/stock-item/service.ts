import { Op, Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import { StockItemModel } from './model';
import { ProductVariantModel } from '../product-variant/model';
import { ShopModel } from '../shop/model';
import { ProductModel } from '../product/model';
import { ShopService } from '../shop/service';
import { TransactionItemModel } from '../transaction-item/model';
import { TransactionModel } from '../transaction/model';
import { BillingItemModel } from '../billing-item/model';
import { BillingModel } from '../billing/model';
import { StockModel } from '../stock/model';
import {
	CreateStockItemDto,
	PartialStockItem,
	StockOperation,
	UpdateMultipleStockItemDto,
	UpdateStockItemDto,
	UpdateStockItemQtyDto,
} from './types';
import { BillingStatus } from '../billing/types';
import { ProductCategoryModel } from '../product-category/model';
import { ProductCategoryGroupModel } from '../product-category-group/model';

export class StockItemService {
	private stockItemModel;
	private shopService;

	constructor(stockItemModel: typeof StockItemModel) {
		this.stockItemModel = stockItemModel;
		this.shopService = new ShopService(ShopModel);
	}

	getAllByStock = async (shopSlug: string) => {
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
					[
						sequelize.col(
							'productVariants.product.productCategory.productCategoryGroup.name',
						),
						'productCategoryGroupName',
					],
					[sequelize.col('productVariants.id'), 'productVariantId'],
					[sequelize.col('productVariants.vId'), 'vId'],
					'stockId',
					'currency',
					'price',
					'quantity',
					'cost',
					'minQty',
					'maxQty',
					'updatedDate',
					[
						sequelize.literal(`(
								SELECT COALESCE(SUM(ti.quantity), 0)
								FROM transaction_item ti
								INNER JOIN transaction t ON ti."transactionId" = t.id
								WHERE ti."productVariantId" = "productVariants"."id"
								AND t.type = 'TRANSFER' 
								AND t."toId" = "StockItemModel"."stockId" 
								AND t.state = 'PROGRESS'
						)`),
						'quantityInTransit',
					],
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
								include: [
									{
										model: ProductCategoryModel,
										as: 'productCategory',
										attributes: [],
										required: true,
										include: [
											{
												model: ProductCategoryGroupModel,
												as: 'productCategoryGroup',
												attributes: [],
												required: true,
											},
										],
									},
								],
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

	getOneByStock = async (productVariantId: string, stockId: string) => {
		try {
			const stockItem = await this.stockItemModel.findOne({
				where: { stockId },
				attributes: [
					'id',
					'quantity',
					'currency',
					'price',
					'cost',
					[sequelize.col('stock.name'), 'stockName'],
				],
				include: [
					{
						model: ProductVariantModel,
						as: 'productVariants',
						where: { id: productVariantId },
						attributes: [],
						through: { attributes: [] },
					},
					{
						model: StockModel,
						as: 'stock',
						attributes: [],
						required: true,
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
					'maxQty',
					'minQty',
					'stockId',
					[sequelize.col('productVariants.product.name'), 'productName'],
					[sequelize.col('productVariants.id'), 'productVariantId'],
					[sequelize.col('productVariants.name'), 'productVariantName'],
				],
				include: [
					{
						model: ProductVariantModel,
						as: 'productVariants',
						required: true,
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
			console.error('Error getting stock item by id');
			throw error;
		}
	};

	getHistory = async (id: string) => {
		try {
			const stockItem = await this.getOneById(id);
			if (!stockItem) {
				throw new Error('Item de stock no encontrado');
			}
			const {
				stockId,
				quantity,
				maxQty,
				minQty,
				productVariantId,
				productName,
				productVariantName,
			} = stockItem.dataValues;

			const stock = await StockModel.findOne({
				where: { id: stockId },
				attributes: ['id', 'shopId'],
			});

			const enters = await TransactionItemModel.findAll({
				where: { productVariantId },
				attributes: [
					'id',
					'transactionId',
					'quantity',
					'stockBefore',
					'createdDate',
					[sequelize.col('transaction.type'), 'type'],
					[sequelize.col('transaction.fromId'), 'fromId'],
					[sequelize.col('transaction.stockFrom.name'), 'fromName'],
					[sequelize.col('transaction.toId'), 'toId'],
					[sequelize.col('transaction.stockTo.name'), 'toName'],
					[sequelize.col('transaction.description'), 'identifier'],
					[sequelize.col('transaction.state'), 'state'],
				],
				include: [
					{
						model: TransactionModel,
						as: 'transaction',
						where: { type: 'ENTER', toId: stockId },
						attributes: [],
						include: [
							{
								model: StockModel,
								as: 'stockFrom',
								attributes: [],
							},
							{
								model: StockModel,
								as: 'stockTo',
								attributes: [],
							},
						],
					},
				],
				order: [['createdDate', 'DESC']],
			});

			const exits = await TransactionItemModel.findAll({
				where: { productVariantId },
				attributes: [
					'id',
					'transactionId',
					'quantity',
					'stockBefore',
					'createdDate',
					[sequelize.col('transaction.type'), 'type'],
					[sequelize.col('transaction.fromId'), 'fromId'],
					[sequelize.col('transaction.stockFrom.name'), 'fromName'],
					[sequelize.col('transaction.toId'), 'toId'],
					[sequelize.col('transaction.stockTo.name'), 'toName'],
					[sequelize.col('transaction.description'), 'identifier'],
					[sequelize.col('transaction.state'), 'state'],
				],
				include: [
					{
						model: TransactionModel,
						as: 'transaction',
						where: {
							type: { [Op.in]: ['EXIT', 'TRANSFER'] },
							fromId: stockId,
						},
						attributes: [],
						include: [
							{
								model: StockModel,
								as: 'stockFrom',
								attributes: [],
							},
							{
								model: StockModel,
								as: 'stockTo',
								attributes: [],
							},
						],
					},
				],
				order: [['createdDate', 'DESC']],
			});

			const billings = await BillingItemModel.findAll({
				where: { productVariantId },
				attributes: [
					'id',
					'billingId',
					'currency',
					'quantity',
					[sequelize.col('billing.effectiveDate'), 'createdDate'],
					[sequelize.literal(`'BILLING'`), 'type'],
					[sequelize.col('billing.serialNumber'), 'identifier'],
					[sequelize.col('billing.shopId'), 'shopId'],
					[sequelize.col('billing.status'), 'state'],
				],
				include: [
					{
						model: BillingModel,
						as: 'billing',
						where: {
							status: BillingStatus.PAID,
							shopId: stock?.dataValues?.shopId,
						},
						attributes: [],
					},
				],
				order: [['createdDate', 'DESC']],
			});

			const historyAsc = [...enters, ...exits, ...billings].sort(
				(a, b) =>
					new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime(),
			);

			let lastTransactionStockAfter = null;
			let lastBillingStockBefore = null;

			for (const item of historyAsc) {
				const type = item.getDataValue('type');

				if (['ENTER', 'EXIT', 'TRANSFER'].includes(type)) {
					const stockBefore = 'stockBefore' in item && item.stockBefore;
					const quantity = item.getDataValue('quantity');

					const delta = type === 'ENTER' ? quantity : -quantity;
					lastTransactionStockAfter = stockBefore + delta;

					lastBillingStockBefore = null;
				}

				if (type === 'BILLING') {
					const quantity = item.getDataValue('quantity');

					if (
						lastBillingStockBefore === null &&
						lastTransactionStockAfter !== null
					) {
						item.setDataValue('stockBefore', lastTransactionStockAfter);
						lastBillingStockBefore = lastTransactionStockAfter - quantity;
					} else if (lastBillingStockBefore !== null) {
						item.setDataValue('stockBefore', lastBillingStockBefore);
						lastBillingStockBefore -= quantity;
					} else {
						item.setDataValue('stockBefore', 0);
						lastBillingStockBefore = -quantity;
					}
				}
			}

			const history = historyAsc.sort(
				(a, b) =>
					new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
			);

			if (history.length > 0) {
				return {
					status: 200,
					stockItem: {
						productName,
						productVariantName,
						quantity,
						maxQty,
						minQty,
					},
					history,
				};
			}
		} catch (error) {
			console.error('Error getting stock item history');
			throw error;
		}
	};

	createInMultipleStocks = async (
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
				{ ...stockItemRest, quantity: 0 },
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

	updateInMultipleStocks = async ({
		id,
		stockIds,
		stockItemData,
	}: UpdateMultipleStockItemDto) => {
		try {
			const { productVariantId } = stockItemData;

			const missingStocks: string[] = [];

			const stockItems = [
				{ id, currency: 'COP' },
				...(await Promise.all(
					stockIds.map(async stockId => {
						const stock = await StockModel.findByPk(stockId);
						const stockItem = await this.getOneByStock(
							productVariantId,
							stockId,
						);

						const stockName = stock?.dataValues.name;
						const itemStockName = stockItem?.dataValues.stockName || '';

						if (stockName && !itemStockName.includes(stockName)) {
							missingStocks.push(stockName);
						}

						return {
							id: stockItem?.dataValues.id,
							currency: stockItem?.dataValues.currency,
						};
					}),
				)),
			];

			if (missingStocks.length > 0) {
				throw new Error(
					`El item no existe en: ${missingStocks.map(stock => `◾ ${stock}`).join(' ')}`,
				);
			}

			const results = await Promise.all(
				stockItems.map(({ id, currency }) => {
					const price =
						currency === 'USD' ? stockItemData.priceUsd : stockItemData.price;
					const cost =
						currency === 'USD' ? stockItemData.costUsd : stockItemData.cost;

					return this.update({
						id,
						stockItemData: { ...stockItemData, price, cost },
					});
				}),
			);

			const result = results[0];

			return {
				status: result?.status,
				updatedStockItem: result?.updatedStockItem,
			};
		} catch (error) {
			console.error('Error updating stock items');
			throw error;
		}
	};

	update = async ({ id, stockItemData }: UpdateStockItemDto) => {
		try {
			const { productVariantId, ...stockItemRest } = stockItemData;

			if ('quantity' in stockItemData) {
				throw new Error(
					'No se puede modificar directamente la cantidad en stock',
				);
			}

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

	updateQuantity = async (
		{ quantity, name, productVariantId, stockId }: UpdateStockItemQtyDto,
		operation: StockOperation = StockOperation.SUBTRACT,
		transaction: Transaction,
	) => {
		try {
			const stockItemToUpdate = await this.getOneByStock(
				productVariantId,
				stockId as string,
			);

			if (!stockItemToUpdate) {
				throw new Error(`No fue posible encontrar el producto ${name}`);
			}

			const currentQty = Number(stockItemToUpdate?.quantity);
			const delta = Number(quantity);

			if (isNaN(currentQty) || isNaN(delta)) {
				throw new Error(`Ocurrió un error con las cantidades del item ${name}`);
			}

			if (operation === StockOperation.SUBTRACT && currentQty < delta) {
				throw new Error(`No hay suficiente stock (${currentQty}) para ${name}`);
			}

			const newQuantity =
				operation === StockOperation.ADD
					? currentQty + delta
					: currentQty - delta;

			await stockItemToUpdate.update(
				{ quantity: newQuantity },
				{ transaction },
			);
		} catch (error) {
			console.error('Error updating stock item quantity');
			throw error;
		}
	};

	delete = async (id: string) => {
		try {
			const stockItem = await this.stockItemModel.findByPk(id);
			if (!stockItem)
				throw new Error(
					'No existe en el stock el producto que estás intentando eliminar',
				);

			if (Number(stockItem?.quantity) > 0) {
				throw new Error(
					`No puedes eliminar un item con cantidad en stock (${stockItem?.quantity} unds)`,
				);
			}

			const result = await this.stockItemModel.destroy({ where: { id } });

			if (result === 1) {
				return {
					status: 200,
					message: 'Producto eliminado del stock con éxito',
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
