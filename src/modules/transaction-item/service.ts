import { Transaction } from 'sequelize';
import { StockItemModel } from '../stock-item/model';
import { TransactionItemModel } from './model';
import { CreateTransactionItemDto, UpdateTransactionItemDto } from './types';
import { StockItemService } from '../stock-item/service';
import { ProductVariantModel } from '../product-variant/model';
import { ProductModel } from '../product/model';
import { sequelize } from '../../config/database';

export class TransactionItemService {
	private transactionItemModel;
	private stockItemService;

	constructor(transactionItemModel: typeof TransactionItemModel) {
		this.transactionItemModel = transactionItemModel;
		this.stockItemService = new StockItemService(StockItemModel);
	}

	getByTransactionId = async (transactionId: string, stockId: string) => {
		try {
			const transactionItems = await this.transactionItemModel.findAll({
				where: { transactionId },
				attributes: [
					'id',
					'quantity',
					'totalQuantity',
					'productVariantId',
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

			const formattedItems = [];
			for (const item of transactionItems) {
				const stockItem = await this.stockItemService.getOne(
					item?.dataValues?.productVariantId,
					stockId,
				);

				formattedItems.push({
					...item.dataValues,
					stockItemId: stockItem?.dataValues?.id,
					stockItemQuantity: stockItem?.dataValues?.quantity,
				});
			}

			return { status: 200, transactionItems: formattedItems };
		} catch (error) {
			console.error('Error obteniendo items de transacción');
			throw error;
		}
	};

	create = async (
		{
			transactionItemData,
			isEnter,
		}: {
			transactionItemData: CreateTransactionItemDto;
			isEnter: boolean;
		},
		sqlTransaction: Transaction,
	) => {
		try {
			const { stockItemId, ...restItem } = transactionItemData;

			const stockItemToUpdate = await this.stockItemService.getOneById(
				stockItemId,
				sqlTransaction,
			);
			if (!stockItemToUpdate) {
				throw new Error('No fue posible encontrar el item de stock');
			}

			if (
				!isEnter &&
				Number(restItem.quantity) > Number(stockItemToUpdate?.quantity)
			) {
				const { productName, productVariantName } =
					stockItemToUpdate.dataValues ?? {};
				throw new Error(
					`La cantidad a egresar de ${productName} ${productVariantName}, es mayor a la cantidad en stock`,
				);
			}

			const newTransactionItem = await this.transactionItemModel.create(
				{
					...restItem,
					totalQuantity: stockItemToUpdate?.quantity,
				},
				{ transaction: sqlTransaction },
			);

			const currentQty = Number(stockItemToUpdate.quantity);
			const delta = Number(restItem.quantity);

			if (isNaN(currentQty) || isNaN(delta)) {
				throw new Error(
					`Ocurrió un error con las cantidades del item ${stockItemToUpdate.dataValues.productName} - ${stockItemToUpdate.dataValues.productVariantName}`,
				);
			}

			const newQuantity = isEnter ? currentQty + delta : currentQty - delta;

			await stockItemToUpdate.update(
				{ quantity: newQuantity },
				{ transaction: sqlTransaction },
			);

			const stockItemCheck = await StockItemModel.findByPk(stockItemId, {
				transaction: sqlTransaction,
			});

			if (Number(stockItemCheck?.quantity) !== newQuantity) {
				throw new Error(
					`Cantidad a actualizar era ${newQuantity}, pero se encontró ${stockItemCheck?.quantity}`,
				);
			}

			return newTransactionItem;
		} catch (error) {
			console.error('Error creando items de transacción');
			throw error;
		}
	};

	update = async (
		transactionItemData: UpdateTransactionItemDto,
		sqlTransaction: Transaction,
	) => {
		try {
			const { stockItemId, id, ...restItem } = transactionItemData;

			const stockItemToUpdate = await this.stockItemService.getOneById(
				stockItemId,
				sqlTransaction,
			);
			if (!stockItemToUpdate) {
				throw new Error('No fue posible encontrar item de stock');
			}

			const transactionItemToUpdate = await this.transactionItemModel.findByPk(
				id,
				{ transaction: sqlTransaction },
			);
			if (!transactionItemToUpdate) {
				throw new Error('No fue posible encontrar item de transacción');
			}

			if (
				Number(restItem.quantity) >
				Number(transactionItemToUpdate?.dataValues?.quantity) +
					Number(stockItemToUpdate?.dataValues?.quantity)
			) {
				const { productName, productVariantName } =
					stockItemToUpdate.dataValues ?? {};
				throw new Error(
					`La cantidad a transferir de ${productName} ${productVariantName}, es mayor a la cantidad en stock`,
				);
			}

			const currentTransactionItemQty = Number(
				transactionItemToUpdate?.dataValues?.quantity,
			);
			const currentStockItemQty = Number(
				stockItemToUpdate?.dataValues?.quantity,
			);
			const delta = Number(restItem?.quantity);

			if (isNaN(currentTransactionItemQty) || isNaN(currentStockItemQty) || isNaN(delta)) {
				throw new Error(
					`Ocurrió un error con las cantidades del item ${stockItemToUpdate.dataValues.productName} - ${stockItemToUpdate.dataValues.productVariantName}`,
				);
			}

			const newStockItemQuantity =
				currentTransactionItemQty + currentStockItemQty - delta;

			await transactionItemToUpdate.update(
				{ quantity: delta },
				{ transaction: sqlTransaction },
			);

			await stockItemToUpdate.update(
				{ quantity: newStockItemQuantity },
				{ transaction: sqlTransaction },
			);

			return transactionItemToUpdate;
		} catch (error) {
			console.error('Error actualizando items de transascción');
			throw error;
		}
	};
}
