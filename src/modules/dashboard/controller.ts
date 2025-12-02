import { Handler } from 'express';
import { ProductVariantModel } from '../product-variant/model';
import { CustomerModel } from './../customer/model';
import { BillingItemModel } from '../billing-item/model';
import { BillingItemService } from '../billing-item/service';
import { CustomerService } from '../customer/service';

export class DashboardController {
	private productVariantModel;
	private customerService;
	private billingItemService;

	constructor() {
		this.productVariantModel = ProductVariantModel;
		this.customerService = new CustomerService(CustomerModel);
		this.billingItemService = new BillingItemService(BillingItemModel);
	}

	getStats: Handler = async (_req, res, next) => {
		try {
			const productVariantsCount = await this.productVariantModel.count({
				where: { deletedDate: null },
			});

			const { customersCountCO, customersCountEC } =
				await this.customerService.countByCountry();

			const sales = await this.billingItemService.getSales();

			const topSalesCurrentMonth =
				await this.billingItemService.getTopSalesProducts(0);

			const topSalesLastMonth =
				await this.billingItemService.getTopSalesProducts(-1);

			res.status(200).json({
				counts: {
					productVariantsCount,
					customersCountCO: customersCountCO,
					customersCountEC: customersCountEC,
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
