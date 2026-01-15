import { StockItemPriceModel } from './model';
import { PriceTypeModel } from '../price-type/model';
import { Transaction } from 'sequelize';

export class StockItemPriceService {
	private stockItemPriceModel;

	constructor(stockItemPriceModel: typeof StockItemPriceModel) {
		this.stockItemPriceModel = stockItemPriceModel;
	}

	getPriceByType = async (
		stockItemId: string,
		priceTypeCode: string,
		transaction?: Transaction,
	): Promise<number | undefined> => {
		try {
			const priceType = await PriceTypeModel.findOne({
				where: { code: priceTypeCode },
				transaction,
			});

			if (!priceType) {
				throw new Error(`Tipo de precio ${priceTypeCode} no encontrado`);
			}

			// Buscar el precio específico
			const priceRecord = await StockItemPriceModel.findOne({
				where: {
					stockItemId,
					priceTypeId: priceType.id,
				},
				transaction,
			});

			if (priceRecord) {
				return parseFloat(priceRecord.price.toString());
			}
		} catch (error) {
			console.error('Error getting price by type');
			throw error;
		}
	};

	create = async (
		stockItemId: string,
		priceTypeId: string,
		price: number,
		transaction?: Transaction,
	) => {
		await StockItemPriceModel.create(
			{
				stockItemId,
				priceTypeId,
				price,
			},
			{ transaction },
		);
	};

	update = async (stockItemId: string, priceTypeId: string, price: number) => {
		await StockItemPriceModel.upsert(
			{
				stockItemId,
				priceTypeId,
				price,
				updatedDate: new Date(),
			},
			{
				conflictFields: ['stockItemId', 'priceTypeId'],
			},
		);
	};
}
