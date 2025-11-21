import { Handler } from 'express';
import { BillingService } from './service';
import { CustomRequest } from '../types';
import { BillingStatus, PaymentMethod } from './types';

export class BillingController {
	private billingService;

	constructor(billingService: BillingService) {
		this.billingService = billingService;
	}

	getAll: Handler = async (req, res, next) => {
		try {
			const shopId = (req.query.shopId as string) || '';
			const page = parseInt(req.query.page as string) || 1;
			const pageSize = parseInt(req.query.pageSize as string) || 30;

			const filters = {
				serialNumber: req.query.serialNumber as string,
				status: req.query.status as BillingStatus[],
				paymentMethods: req.query.paymentMethods as PaymentMethod[],
				customerName: req.query.customerName as string,
				dateStart: req.query.dateStart as string,
				dateEnd: req.query.dateEnd as string,
			};

			console.log(filters.paymentMethods);

			const result = await this.billingService.getAll(
				shopId,
				page,
				pageSize,
				filters,
			);

			res.status(result.status).json(result.data);
		} catch (error) {
			next(error);
		}
	};

	getOne: Handler = async (req, res, next) => {
		try {
			const { serialNumber } = req.params;
			const result = await this.billingService.getOne(serialNumber);
			if (result.status !== 200) {
				res.sendStatus(result.status);
				return;
			}

			res.status(200).json(result.billing);
		} catch (error) {
			next(error);
		}
	};

	create: Handler = async (req, res, next) => {
		try {
			const requestedBy = (req as CustomRequest).requestedBy;

			const result = await this.billingService.create({
				billingData: { ...req.body?.billingData, requestedBy },
				customerData: req.body?.customerData,
			});

			if (result.status === 201) {
				res.status(result.status).json({
					newBilling: result.newBilling,
					message: result.message ?? 'Factura generada con éxito',
				});
				return;
			}

			res.sendStatus(400);
		} catch (error) {
			next(error);
		}
	};

	update: Handler = async (req, res, next) => {
		try {
			const requestedBy = (req as CustomRequest).requestedBy;
			const { id } = req.params;

			const result = await this.billingService.update(
				{ ...req.body, requestedBy },
				id,
			);

			if (result.status === 200) {
				res.status(result.status).json({
					message: result.message ?? 'Factura actualizada con éxito',
				});
				return;
			}

			res.sendStatus(400);
		} catch (error) {
			next(error);
		}
	};

	cancel: Handler = async (req, res, next) => {
		try {
			const requestedBy = (req as CustomRequest).requestedBy;

			const { serialNumber } = req.params;
			const result = await this.billingService.cancel(
				serialNumber,
				requestedBy,
			);

			res.status(result.status).json({ message: result.message });
		} catch (error) {
			next(error);
		}
	};
}
