import { BillingItemService } from './../billing-item/service';
import { Handler } from 'express';
import { BillingService } from './service';
import { BillingItemModel } from '../billing-item/model';
import { CustomRequest } from '../types';

export class BillingController {
	private billingService;
	private billingItemService;

	constructor(billingService: BillingService) {
		this.billingService = billingService;
		this.billingItemService = new BillingItemService(BillingItemModel);
	}

	getAll: Handler = async (req, res, next) => {
		try {
			const shopSlug = (req.query.shopSlug as string) || '';
			const result = await this.billingService.getAll(shopSlug);

			res.status(result.status).json(result.billings);
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
			if (result.status !== 201) {
				res.sendStatus(500);
				return;
			}

			res.status(result.status).json({
				newBilling: result.newBilling,
				message: 'Factura generada con éxito',
			});
		} catch (error) {
			next(error);
		}
	};

	cancel: Handler = async (req, res, next) => {
		try {
			const { serialNumber } = req.params;
			const result = await this.billingService.cancel(serialNumber);

			res.status(result.status).json({ message: result.message });
		} catch (error) {
			next(error);
		}
	};
}
