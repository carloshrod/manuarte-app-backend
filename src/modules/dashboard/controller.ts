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
			const productVariantsCount = await this.productVariantModel.count({
				where: { deletedDate: null },
			});
			const customersCount = await this.customerModel.count({
				where: { deletedDate: null },
			});
			const sales = await this.billingItemService.getMonthlySales();
			const topSalesCurrentMonth =
				await this.billingItemService.getTopSalesProducts(0);
			const topSalesLastMonth =
				await this.billingItemService.getTopSalesProducts(-1);

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
