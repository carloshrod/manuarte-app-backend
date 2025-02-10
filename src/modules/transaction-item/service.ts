import { Transaction } from 'sequelize';
import { StockItemModel } from '../stock-item/model';
import { TransactionItemModel } from './model';
import { CreateTransactionItemDto } from './types';
import { StockItemService } from '../stock-item/service';

export class TransactionItemService {
	private transactionItemModel;
	private stockItemService;

	constructor(transactionItemModel: typeof TransactionItemModel) {
		this.transactionItemModel = transactionItemModel;
		this.stockItemService = new StockItemService(StockItemModel);
	}

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
