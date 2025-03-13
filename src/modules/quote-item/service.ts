import { Transaction } from 'sequelize';
import { QuoteItemModel } from './model';
import { CreateQuoteItemDto } from './types';

export class QuoteItemService {
	private quoteItemModel;

	constructor(quoteItemModel: typeof QuoteItemModel) {
		this.quoteItemModel = quoteItemModel;
	}

	create = async (
		quoteItemData: CreateQuoteItemDto,
		transaction: Transaction,
	) => {
		try {
			const newQuoteItem = await this.quoteItemModel.create(quoteItemData, {
				transaction,
			});

			return newQuoteItem;
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	getItemsByQuoteId = async (quoteId: string) => {
		try {
			const quoteItems = await this.quoteItemModel.findAll({
				where: { quoteId },
			});

			return quoteItems;
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	updateItems = async (
		items: CreateQuoteItemDto[],
		quoteId: string,
		transaction: Transaction,
	) => {
		try {
			const existingItems = await this.getItemsByQuoteId(quoteId);
			const existingItemIds = new Set(existingItems.map(item => item.id));
			const itemIds = new Set();

			for (const item of items) {
				if (item?.id && existingItemIds.has(item.id)) {
					await this.quoteItemModel.update(
						{ ...item },
						{ where: { id: item.id }, transaction },
					);
					itemIds.add(item.id);
				} else {
					const newItem = await this.quoteItemModel.create(
						{
							...item,
							quoteId,
						},
						{ transaction },
					);
					itemIds.add(newItem.id);
				}
			}

			for (const existingItem of existingItems) {
				if (!itemIds.has(existingItem.id)) {
					await existingItem.destroy({ transaction });
				}
			}
		} catch (error) {
			console.error('Error actualizando items de cotización');
			throw error;
		}
	};
}
