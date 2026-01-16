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

	getStats: Handler = async (req, res, next) => {
		try {
			const productVariantsCount = await this.productVariantModel.count({
				where: { deletedDate: null },
			});

			const { customersCountCO, customersCountEC } =
				await this.customerService.countByCountry();

			// Obtener año y mes desde query params o usar fecha actual
			const now = new Date();
			const year = req.query.year
				? parseInt(req.query.year as string)
				: now.getFullYear();

			const sales = await this.billingItemService.getSales(year);

			res.status(200).json({
				counts: {
					productVariantsCount,
					customersCountCO: customersCountCO,
					customersCountEC: customersCountEC,
				},
				sales,
			});
		} catch (error) {
			next(error);
		}
	};

	getTopSales: Handler = async (req, res, next) => {
		try {
			// Obtener año y mes desde query params o usar fecha actual
			const now = new Date();
			const year = req.query.year
				? parseInt(req.query.year as string)
				: now.getFullYear();
			const month = req.query.month
				? parseInt(req.query.month as string) - 1
				: now.getMonth(); // Restar 1 porque en la API el mes es 1-12 pero en JS es 0-11

			// Validar mes (0-11 en JS)
			if (month < 0 || month > 11) {
				res
					.status(400)
					.json({ message: 'Mes inválido. Debe ser entre 1 y 12' });
				return;
			}

			// Calcular mes anterior
			const lastMonthDate = new Date(year, month - 1, 1);

			// Ejecutar consultas en paralelo
			const [topSalesCurrentMonth, topSalesLastMonth] = await Promise.all([
				this.billingItemService.getTopSalesProducts(year, month),
				this.billingItemService.getTopSalesProducts(
					lastMonthDate.getFullYear(),
					lastMonthDate.getMonth(),
				),
			]);

			res.status(200).json({
				topSalesCurrentMonth,
				topSalesLastMonth,
			});
		} catch (error) {
			next(error);
		}
	};

	getTopSalesReport: Handler = async (req, res, next) => {
		try {
			const currency = (req.query.currency as 'COP' | 'USD') || 'COP';

			// Obtener año y mes desde query params o usar fecha actual
			const now = new Date();
			const year = req.query.year
				? parseInt(req.query.year as string)
				: now.getFullYear();
			const month = req.query.month
				? parseInt(req.query.month as string) - 1
				: now.getMonth(); // Restar 1 porque en la API el mes es 1-12 pero en JS es 0-11

			// Validar mes (0-11 en JS)
			if (month < 0 || month > 11) {
				res
					.status(400)
					.json({ message: 'Mes inválido. Debe ser entre 1 y 12' });
				return;
			}

			// Validar currency
			if (!['COP', 'USD'].includes(currency)) {
				res.status(400).json({
					message: 'Moneda inválida. Debe ser COP o USD',
				});
				return;
			}

			// Calcular inicio y fin del mes
			const startDate = new Date(year, month, 1);
			const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

			const report = await this.billingItemService.getDetailedSalesReport(
				currency,
				startDate,
				endDate,
			);

			res.status(200).json(report);
		} catch (error) {
			next(error);
		}
	};
}
