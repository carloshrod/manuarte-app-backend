import { Op, Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import { CreateBillingItemDto, MonthlySalesData } from './types';
import { BillingItemModel } from './model';
import { monthNames } from './consts';
import { StockItemService } from '../stock-item/service';
import { StockItemModel } from '../stock-item/model';
import { BillingModel } from '../billing/model';
import { BillingStatus } from '../billing/types';

export class BillingItemService {
	private billingItemModel;
	private stockItemService;

	constructor(billingItemModel: typeof BillingItemModel) {
		this.billingItemModel = billingItemModel;
		this.stockItemService = new StockItemService(StockItemModel);
	}

	create = async (
		billingItemData: CreateBillingItemDto,
		transaction: Transaction,
	) => {
		try {
			const { quantity, name, productVariantId, shopId } = billingItemData;

			const stockItemToUpdate = await this.stockItemService.getOne(
				productVariantId,
				shopId as string,
			);
			if (!stockItemToUpdate) {
				throw new Error(`No fue posible encontrar el producto ${name}`);
			}
			if (Number(stockItemToUpdate?.quantity) < quantity) {
				throw new Error(
					`No hay suficiente stock (${stockItemToUpdate?.quantity}) para ${name}`,
				);
			}

			const newBillingItem = await this.billingItemModel.create(
				billingItemData,
				{ transaction },
			);

			const newQuantity = Number(stockItemToUpdate?.quantity) - quantity;
			await stockItemToUpdate.update({ quantity: newQuantity });

			return newBillingItem;
		} catch (error) {
			console.error('Error creando items de factura');
			throw error;
		}
	};

	cancel = async ({
		billingItemData,
		shopId,
		transaction,
	}: {
		billingItemData: CreateBillingItemDto;
		shopId: string;
		transaction: Transaction;
	}) => {
		try {
			const { productVariantId, quantity } = billingItemData;

			const stockItemToUpdate = await this.stockItemService.getOne(
				productVariantId,
				shopId,
			);

			if (!stockItemToUpdate) {
				throw new Error(`No fue posible encontrar el producto`);
			}

			const newQuantity = Number(stockItemToUpdate?.quantity) + quantity;
			await stockItemToUpdate.update(
				{ quantity: newQuantity },
				{ transaction },
			);

			return stockItemToUpdate;
		} catch (error) {
			console.error('Error cancelando items de factura');
			throw error;
		}
	};

	getMonthlySales = async () => {
		try {
			const currentYear = new Date().getFullYear();
			const startOfYear = new Date(currentYear, 0, 1);
			const endOfYear = new Date(currentYear + 1, 0, 0);

			const rawSales = await BillingModel.findAll({
				attributes: [
					[
						sequelize.fn(
							'DATE_PART',
							'month',
							sequelize.col('billingItems.createdDate'),
						),
						'month',
					],
					[sequelize.col('billingItems.currency'), 'currency'],
					[
						sequelize.fn('SUM', sequelize.col('billingItems.totalPrice')),
						'totalSales',
					],
				],
				where: {
					createdDate: {
						[Op.between]: [startOfYear, endOfYear],
					},
					status: BillingStatus.PAID,
				},
				include: [
					{
						model: this.billingItemModel,
						as: 'billingItems',
						attributes: [],
						required: true,
					},
				],
				group: [
					sequelize.fn(
						'DATE_PART',
						'month',
						sequelize.col('billingItems.createdDate'),
					),
					'month',
					'currency',
				],
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
					'productVariantId',
					[sequelize.fn('MIN', sequelize.col('name')), 'name'],
					[sequelize.fn('SUM', sequelize.col('totalPrice')), 'totalSales'],
				],
				include: [
					{
						model: BillingModel,
						as: 'billing',
						attributes: [],
						where: {
							status: BillingStatus.PAID,
						},
					},
				],
				group: [
					'BillingItemModel.currency',
					'BillingItemModel.productVariantId',
				],
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
					'productVariantId',
					[sequelize.fn('MIN', sequelize.col('name')), 'name'],
					[sequelize.fn('SUM', sequelize.col('totalPrice')), 'totalSales'],
				],
				include: [
					{
						model: BillingModel,
						as: 'billing',
						attributes: [],
						where: {
							status: BillingStatus.PAID,
						},
					},
				],
				group: [
					'BillingItemModel.currency',
					'BillingItemModel.productVariantId',
				],
				order: [[sequelize.fn('SUM', sequelize.col('totalPrice')), 'DESC']],
				limit: 5,
			});

			const formatResults = (
				data: BillingItemModel[],
			): {
				name: string;
				productVariantId: string;
				totalSales: number;
			}[] =>
				data.map(item => ({
					name: item.name,
					productVariantId: item.productVariantId,
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
