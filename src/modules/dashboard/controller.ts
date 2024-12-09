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

	getStats: Handler = async (req, res, next) => {
		try {
			const month = parseInt(req.query.month as string);
			const productVariantsCount = await this.productVariantModel.count();
			const customersCount = await this.customerModel.count();
			const sales = await this.billingItemService.getMonthlySales();
			const topSalesCurrentMonth =
				await this.billingItemService.getTopSalesProducts(month);
			const topSalesLastMonth =
				await this.billingItemService.getTopSalesProducts(month - 1);

			res.status(200).json({
				counts: {
					productVariantsCount,
					customersCount,
				},
				sales,
				topSalesCurrentMonth,
				topSalesLastMonth,
			});
		} catch (error) {
			next(error);
		}
	};
}
