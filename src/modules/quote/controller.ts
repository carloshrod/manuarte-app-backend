import { Handler } from 'express';
import { QuoteService } from './service';
import { CustomRequest } from '../types';
import { QuoteStatus } from './types';

export class QuoteController {
	private quoteService;

	constructor(quoteService: QuoteService) {
		this.quoteService = quoteService;
	}

	getAll: Handler = async (req, res, next) => {
		try {
			const shopId = (req.query.shopId as string) || '';
			const page = parseInt(req.query.page as string) || 1;
			const pageSize = parseInt(req.query.pageSize as string) || 30;

			const filters = {
				serialNumber: req.query.serialNumber as string,
				status: req.query.status as QuoteStatus,
				customerName: req.query.customerName as string,
				dateStart: req.query.dateStart as string,
				dateEnd: req.query.dateEnd as string,
			};

			const result = await this.quoteService.getAll(
				shopId,
				page,
				pageSize,
				filters,
			);
			if (result.status !== 200) {
				res.sendStatus(result.status);
				return;
			}

			res.status(200).json(result?.data);
		} catch (error) {
			next(error);
		}
	};

	getOne: Handler = async (req, res, next) => {
		try {
			const { serialNumber } = req.params;
			const result = await this.quoteService.getOne(serialNumber);
			if (result.status !== 200) {
				res.sendStatus(result.status);
				return;
			}

			res.status(200).json(result.quote);
		} catch (error) {
			next(error);
		}
	};

	create: Handler = async (req, res, next) => {
		try {
			const requestedBy = (req as CustomRequest).requestedBy;

			const result = await this.quoteService.create({
				quoteData: { ...req.body?.quoteData, requestedBy },
				customerData: req.body?.customerData,
			});

			if (result.status !== 201) {
				res.sendStatus(500);
				return;
			}

			res.status(result.status).json({
				newQuote: result.newQuote,
				message: 'Cotización generada con éxito',
			});
		} catch (error) {
			next(error);
		}
	};

	update: Handler = async (req, res, next) => {
		try {
			const { id } = req.params;
			const { quoteData, customerData } = req.body;
			const requestedBy = (req as CustomRequest).requestedBy;

			const result = await this.quoteService.update({
				quoteData: {
					id,
					...quoteData,
					requestedBy,
				},
				customerData,
			});
			if (result.status !== 200) {
				res.sendStatus(500);
				return;
			}

			res.status(result.status).json({
				updatedQuote: result.updatedQuote,
				message: 'Cotización actualizada con éxito',
			});
		} catch (error) {
			next(error);
		}
	};

	delete: Handler = async (req, res, next) => {
		try {
			const { id } = req.params;

			const result = await this.quoteService.delete(id);

			res.status(result.status).json({ message: result.message });
		} catch (error) {
			next(error);
		}
	};
}
