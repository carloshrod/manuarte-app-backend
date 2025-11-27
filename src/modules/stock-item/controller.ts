import { Handler } from 'express';
import { StockItemService } from './service';
import { StockHistoryTransactionType } from './types';

export class StockItemController {
	private stockItemService;

	constructor(stockItemService: StockItemService) {
		this.stockItemService = stockItemService;
	}

	getAllByStock: Handler = async (req, res, next) => {
		try {
			const stockId = (req.query.stockId as string) || '';
			const page = parseInt(req.query.page as string) || 1;
			const pageSize = parseInt(req.query.pageSize as string) || 30;

			const filters = {
				productName: req.query.productName as string,
				productVariantName: req.query.productVariantName as string,
			};

			const report = req.query.report === 'true';

			const result = await this.stockItemService.getAllByStock(
				stockId,
				page,
				pageSize,
				filters,
				report,
			);

			if (result.status !== 200) {
				res.sendStatus(result.status);
				return;
			}

			res.status(result.status).json(result.data);
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
			const page = parseInt(req.query.page as string) || 1;
			const pageSize = parseInt(req.query.pageSize as string) || 30;

			const filters = {
				dateStart: req.query.dateStart as string,
				dateEnd: req.query.dateEnd as string,
				type: req.query.type as StockHistoryTransactionType,
				identifier: req.query.identifier as string,
			};

			const result = await this.stockItemService.getHistory(
				id,
				page,
				pageSize,
				filters,
			);

			if (result?.status === 200) {
				const { status, ...rest } = result;
				res.status(status).json(rest);
				return;
			}

			res.sendStatus(204);
		} catch (error) {
			next(error);
		}
	};
}
