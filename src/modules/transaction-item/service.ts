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

			const stockItemToUpdate =
				await this.stockItemService.getOneById(stockItemId);
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
					totalQuantity: stockItemToUpdate?.dataValues?.quantity,
				},
				{ transaction: sqlTransaction },
			);

			const newQuantity = isEnter
				? Number(stockItemToUpdate?.quantity) + Number(restItem.quantity)
				: Number(stockItemToUpdate?.quantity) - Number(restItem.quantity);

			await stockItemToUpdate.update(
				{ quantity: newQuantity, updatedDate: sequelize.fn('now') },
				{ transaction: sqlTransaction },
			);

			return newTransactionItem;
		} catch (error) {
			console.error('Error creando items de transascción');
			throw error;
		}
	};

	update = async (
		transactionItemData: UpdateTransactionItemDto,
		sqlTransaction: Transaction,
	) => {
		try {
			const { stockItemId, id, ...restItem } = transactionItemData;

			const stockItemToUpdate =
				await this.stockItemService.getOneById(stockItemId);
			if (!stockItemToUpdate) {
				throw new Error('No fue posible encontrar item de stock');
			}

			if (Number(restItem.quantity) > Number(restItem.totalQuantity)) {
				const { productName, productVariantName } =
					stockItemToUpdate.dataValues ?? {};
				throw new Error(
					`La cantidad a transferir de ${productName} ${productVariantName}, es mayor a la cantidad en stock`,
				);
			}

			const transactionItemToUpdate =
				await this.transactionItemModel.findByPk(id);
			if (!transactionItemToUpdate) {
				throw new Error('No fue posible encontrar item de transacción');
			}

			await transactionItemToUpdate.update(
				{
					quantity: restItem?.quantity,
					updatedDate: sequelize.fn('now'),
				},
				{ transaction: sqlTransaction },
			);

			const newQuantity =
				Number(transactionItemData?.totalQuantity) - Number(restItem.quantity);

			await stockItemToUpdate.update(
				{ quantity: newQuantity, updatedDate: sequelize.fn('now') },
				{ transaction: sqlTransaction },
			);

			return transactionItemToUpdate;
		} catch (error) {
			console.error('Error actualizando items de transascción');
			throw error;
		}
	};
}
