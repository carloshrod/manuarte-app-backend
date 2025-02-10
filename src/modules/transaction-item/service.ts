import { Transaction } from 'sequelize';
import { StockItemModel } from '../stock-item/model';
import { TransactionItemModel } from './model';
import { CreateTransactionItemDto } from './types';
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

	getByTransactionId = async (transactionId: string) => {
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

			return { status: 200, transactionItems };
		} catch (error) {
			console.error('Error obteniendo items de transacción');
			throw error;
		}
	};

	create = async (
		transactionItemData: CreateTransactionItemDto,
		isEnter: boolean,
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
				{ quantity: newQuantity },
				{ transaction: sqlTransaction },
			);

			return newTransactionItem;
		} catch (error) {
			console.error('Error creando items de transascción');
			throw error;
		}
	};
}
