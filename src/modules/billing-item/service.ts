import { Op } from 'sequelize';
import { sequelize } from '../../config/database';
import { MonthlySalesData } from './types';
import { BillingItemModel } from './model';
import { monthNames } from './consts';

export class BillingItemService {
	private billingItemModel;

	constructor(billingItemModel: typeof BillingItemModel) {
		this.billingItemModel = billingItemModel;
	}

	getMonthlySales = async () => {
		try {
			const currentYear = new Date().getFullYear();
			const startOfYear = new Date(currentYear, 0, 1);
			const endOfYear = new Date(currentYear + 1, 0, 0);

			const rawSales = await this.billingItemModel.findAll({
				attributes: [
					[
						sequelize.fn('DATE_PART', 'month', sequelize.col('createdDate')),
						'month',
					],
					'currency',
					[sequelize.fn('SUM', sequelize.col('totalPrice')), 'totalSales'],
				],
				where: {
					createdDate: {
						[Op.between]: [startOfYear, endOfYear],
					},
				},
				group: ['month', 'currency'],
				order: [[sequelize.literal('month'), 'ASC']],
				raw: true,
			});

			const sales = rawSales as unknown as MonthlySalesData[];

			const formattedSales = sales.reduce(
				(acc, item) => {
					const month = item.month;
					const currency = item.currency;
					const totalSales = item.totalSales;

					let monthData = acc.find(entry => entry.month === month);

					if (!monthData) {
						monthData = { month };
						acc.push(monthData);
					}

					monthData[currency] = Number(totalSales);
					return acc;
				},
				[] as { month: number; [currency: string]: number | undefined }[],
			);

			const salesWithMonthNames = formattedSales.map(item => ({
				month: monthNames[item.month - 1],
				COP: item.COP ?? 0,
				USD: item.USD ?? 0,
			}));

			return salesWithMonthNames;
		} catch (error) {
			console.error('ServiceError obteniendo ventas por mes: ', error);
			throw error;
		}
	};

	getTopSalesProducts = async (offset: number = 0) => {
		try {
			const now = new Date();
			const currentMonth = now.getMonth();
			const currentYear = now.getFullYear();

			const targetDate = new Date(currentYear, currentMonth + offset, 1);
			const targetMonth = targetDate.getMonth();
			const targetYear = targetDate.getFullYear();

			const startOfMonth = new Date(targetYear, targetMonth, 1);
			const endOfMonth = new Date(targetYear, targetMonth + 1, 0);

			const topCOP = await this.billingItemModel.findAll({
				where: {
					currency: 'COP',
					createdDate: {
						[Op.between]: [startOfMonth, endOfMonth],
					},
					name: {
						[Op.notILike]: '%flete%',
					},
				},
				attributes: [
					'currency',
					'name',
					[sequelize.fn('SUM', sequelize.col('totalPrice')), 'totalSales'],
				],
				group: ['BillingItemModel.currency', 'BillingItemModel.name'],
				order: [[sequelize.fn('SUM', sequelize.col('totalPrice')), 'DESC']],
				limit: 5,
			});

			const topUSD = await this.billingItemModel.findAll({
				where: {
					currency: 'USD',
					createdDate: {
						[Op.between]: [startOfMonth, endOfMonth],
					},
					name: {
						[Op.notILike]: '%flete%',
					},
				},
				attributes: [
					'currency',
					'name',
					[sequelize.fn('SUM', sequelize.col('totalPrice')), 'totalSales'],
				],
				group: ['BillingItemModel.currency', 'BillingItemModel.name'],
				order: [[sequelize.fn('SUM', sequelize.col('totalPrice')), 'DESC']],
				limit: 5,
			});

			const formatResults = (
				data: BillingItemModel[],
			): {
				name: string;
				totalSales: number;
			}[] =>
				data.map(item => ({
					name: item.name,
					totalSales: parseFloat(item.dataValues.totalSales),
				}));

			return {
				month: monthNames[targetMonth],
				year: targetYear,
				topCOP: formatResults(topCOP),
				topUSD: formatResults(topUSD),
			};
		} catch (error) {
			console.error(error);
			throw error;
		}
	};
}
