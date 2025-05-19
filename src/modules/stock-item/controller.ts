import { Handler } from 'express';
import { StockItemService } from './service';

export class StockItemController {
	private stockItemService;

	constructor(stockItemService: StockItemService) {
		this.stockItemService = stockItemService;
	}

	getAllByStock: Handler = async (req, res, next) => {
		try {
			const shopSlug = (req.query.shopSlug as string) || '';

			const result = await this.stockItemService.getAllByStock(shopSlug);

			res.status(result.status).json(result.stockItems);
		} catch (error) {
			next(error);
		}
	};

	getOneByStock: Handler = async (req, res, next) => {
		try {
			const { productVariantId, stockId } = req.params;

			const stockItem = await this.stockItemService.getOneByStock(
				productVariantId,
				stockId,
			);

			if (!stockItem) {
				res.sendStatus(204);
				return;
			}

			res.status(200).json(stockItem);
		} catch (error) {
			next(error);
		}
	};

	create: Handler = async (req, res, next) => {
		try {
			const result = await this.stockItemService.create(req.body);

			if (result.status === 201) {
				res.status(result.status).json({
					newStockItem: result.newStockItem,
					message: 'Stock de producto agregado con éxito',
				});
			}
		} catch (error) {
			next(error);
		}
	};

	update: Handler = async (req, res, next) => {
		try {
			const { id } = req.params;
			const { stockIds, ...restBody } = req.body;

			const result =
				stockIds === undefined || stockIds?.length === 0
					? await this.stockItemService.update({
							id,
							stockItemData: restBody,
						})
					: await this.stockItemService.updateInMultipleStocks({
							id,
							stockIds,
							stockItemData: restBody,
						});

			if (result.status === 200) {
				res.status(result.status).json({
					updatedStockItem: result.updatedStockItem,
					message: 'Stock de producto actualizado con éxito',
				});
			}
		} catch (error) {
			next(error);
		}
	};

	delete: Handler = async (req, res, next) => {
		try {
			const { id } = req.params;

			const result = await this.stockItemService.delete(id);

			res.status(result.status).json({ message: result.message });
		} catch (error) {
			next(error);
		}
	};

	getHistory: Handler = async (req, res, next) => {
		try {
			const { id } = req.params;
			console.log('******************* params', req.params);

			const result = await this.stockItemService.getHistory(id);

			if (result?.status === 200) {
				const { status, stockItem, history } = result;
				res.status(status).json({ stockItem, history });
				return;
			}

			res.sendStatus(204);
		} catch (error) {
			next(error);
		}
	};
}
