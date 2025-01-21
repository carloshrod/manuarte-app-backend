import { Transaction } from 'sequelize';
import { StockItemModel } from './model';
import { ProductVariantModel } from '../product-variant/model';
import { sequelize } from '../../config/database';
import { ShopModel } from '../shop/model';
import { StockModel } from '../stock/model';

export class StockItemService {
	private stockItemModel;

	constructor(stockItemModel: typeof StockItemModel) {
		this.stockItemModel = stockItemModel;
	}

	getOne = async (productVariantId: string, shopId: string) => {
		try {
			const shop = await ShopModel.findByPk(shopId, {
				attributes: ['id', [sequelize.col('stock.id'), 'stockId']],
				include: [
					{
						model: StockModel,
						as: 'stock',
						attributes: [],
					},
				],
			});
			const stockId = shop?.getDataValue('stockId');

			const stockItem = await StockItemModel.findOne({
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

	updateQuantity = async ({
		quantity,
		id,
		transaction,
	}: {
		quantity: number;
		id: string;
		transaction: Transaction;
	}) => {
		try {
			const itemToUpdate = await this.stockItemModel.update(
				{ quantity },
				{ where: { id }, transaction },
			);

			return itemToUpdate;
		} catch (error) {
			console.error('Error actualizando cantidad de stock de items');
			throw error;
		}
	};
}
