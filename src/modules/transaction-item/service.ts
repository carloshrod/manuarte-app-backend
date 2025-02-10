import { Transaction } from 'sequelize';
import { StockItemModel } from '../stock-item/model';
import { TransactionItemModel } from './model';
import { CreateTransactionItemDto } from './types';

export class TransactionItemService {
	private transactionItemModel;

	constructor(transactionItemModel: typeof TransactionItemModel) {
		this.transactionItemModel = transactionItemModel;
	}

	create = async (
		transactionItemData: CreateTransactionItemDto,
		isEnter: boolean,
		sqlTransaction: Transaction,
	) => {
		try {
			const { stockItemId, ...restItem } = transactionItemData;
			console.log(restItem, stockItemId);

			const stockItemToUpdate = await StockItemModel.findByPk(stockItemId);
			if (!stockItemToUpdate) {
				throw new Error(`No fue posible encontrar el producto ${name}`);
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
