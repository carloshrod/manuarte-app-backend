import { Handler } from 'express';
import { ProductVariantModel } from '../product-variant/model';
import { CustomerModel } from './../customer/model';
import { BillingItemModel } from '../billing-item/model';
import { BillingItemService } from '../billing-item/service';

export class DashboardController {
	private productVariantModel;
	private customerModel;
	private billingItemService;

	constructor() {
		this.productVariantModel = ProductVariantModel;
		this.customerModel = CustomerModel;
		this.billingItemService = new BillingItemService(BillingItemModel);
	}

	getStats: Handler = async (_req, res, next) => {
		try {
			const productVariantsCount = await this.productVariantModel.count();
			const customersCount = await this.customerModel.count();

			res.status(200).json({ productVariantsCount, customersCount });
		} catch (error) {
			next(error);
		}
	};

	getMonthlySales: Handler = async (_req, res, next) => {
		try {
			const sales = await this.billingItemService.getMonthlySales();

			res.status(200).json(sales);
		} catch (error) {
			next(error);
		}
	};

	getTopSalesProducts: Handler = async (req, res, next) => {
		try {
			const month = parseInt(req.params?.month);
			const topSales = await this.billingItemService.getTopSalesProducts(month);

			res.status(200).json(topSales);
		} catch (error) {
			next(error);
		}
	};
}
