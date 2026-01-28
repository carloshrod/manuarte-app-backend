import { CreateCustomerDto } from './../customer/types';
import { sequelize } from '../../config/database';
import { CustomerModel } from '../customer/model';
import { PersonModel } from '../person/model';
import { ShopModel } from '../shop/model';
import { BillingModel } from './model';
import { CustomerService } from '../customer/service';
import { BillingItemService } from '../billing-item/service';
import { BillingItemModel } from '../billing-item/model';
import { AddressModel } from '../address/model';
import { StockModel } from '../stock/model';
import { CityModel } from '../city/model';
import { RegionModel } from '../region/model';
import { CountryModel } from '../country/model';
import { BillingPaymentModel } from '../billing-payment/model';
import { StockItemService } from '../stock-item/service';
import { StockItemModel } from '../stock-item/model';
import { StockOperation } from '../stock-item/types';
import { CashMovementService } from '../cash-movement/service';
import { CashMovementModel } from '../cash-movement/model';
import { CashMovementCategory } from '../cash-movement/types';
import { BankTransferMovementService } from '../bank-transfer-movement/service';
import { BankTransferMovementModel } from '../bank-transfer-movement/model';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { col, fn, Op, where } from 'sequelize';
import {
	BillingFilters,
	BillingStatus,
	CreateBillingDto,
	DiscountType,
	Payment,
	PaymentMethod,
	UpdateBillingDto,
} from './types';
import { CustomerBalanceService } from '../customer-balance/service';
import { CustomerBalanceModel } from '../customer-balance/model';
import { CustomerBalanceMovementCategory } from '../customer-balance/types';
import { PriceTypeModel } from '../price-type/model';

export class BillingService {
	private billingModel;
	private billingPaymentModel;
	private billingItemService;
	private stockItemService;
	private customerService;
	private customerBalanceService;
	private cashMovementService;
	private bankTransferMovementService;

	constructor(billingModel: typeof BillingModel) {
		this.billingModel = billingModel;
		this.billingPaymentModel = BillingPaymentModel;
		this.billingItemService = new BillingItemService(BillingItemModel);
		this.stockItemService = new StockItemService(StockItemModel);
		this.customerService = new CustomerService(CustomerModel);
		this.customerBalanceService = new CustomerBalanceService(
			CustomerBalanceModel,
		);
		this.cashMovementService = new CashMovementService(CashMovementModel);
		this.bankTransferMovementService = new BankTransferMovementService(
			BankTransferMovementModel,
		);
	}

	getAll = async (
		shopId: string,
		page: number = 1,
		pageSize: number = 30,
		filters: BillingFilters = {},
	) => {
		try {
			const offset = (page - 1) * pageSize;

			const billingWhere: Record<string, unknown> = {};
			if (filters.serialNumber) {
				billingWhere.serialNumber = { [Op.iLike]: `%${filters.serialNumber}%` };
			}
			if (filters.status) {
				billingWhere.status = filters.status;
			}
			if (filters.dateStart && filters.dateEnd) {
				const start = startOfDay(parseISO(filters.dateStart));
				const end = endOfDay(parseISO(filters.dateEnd));

				billingWhere.effectiveDate = {
					[Op.between]: [start, end],
				};
			}

			const paymentWhere: Record<string, unknown> = {};
			if (filters.paymentMethods) {
				paymentWhere.paymentMethod = filters.paymentMethods;
			}

			const personWhere: Record<string, unknown> = {};
			if (filters.customerName) {
				const normalizedSearch = filters.customerName
					.normalize('NFD')
					.replace(/[\u0300-\u036f]/g, '')
					.toLowerCase();

				personWhere.fullName = where(
					fn('unaccent', fn('lower', col('fullName'))),
					Op.iLike,
					`%${normalizedSearch}%`,
				);
			}

			const { rows: billings, count: total } =
				await this.billingModel.findAndCountAll({
					where: {
						shopId,
						...billingWhere,
						...(filters.paymentMethods && {
							id: {
								[Op.in]: sequelize.literal(`(
									SELECT DISTINCT "billingId"
									FROM "billing_payment"
									WHERE "paymentMethod" IN (${
										Array.isArray(filters.paymentMethods)
											? filters.paymentMethods.map(pm => `'${pm}'`).join(',')
											: `'${filters.paymentMethods}'`
									})
        				)`),
							},
						}),
					},
					attributes: [
						'id',
						'serialNumber',
						'status',
						'discountType',
						'discount',
						'shipping',
						'subtotal',
						'effectiveDate',
						'createdDate',
						'updatedDate',
						'customerId',
						'shopId',
					],
					include: [
						{
							model: this.billingPaymentModel,
							as: 'payments',
							attributes: ['paymentMethod'],
							separate: true,
						},
						{
							model: CustomerModel,
							as: 'customer',
							attributes: ['id'],
							required: Boolean(Object.keys(personWhere).length),
							include: [
								{
									model: PersonModel,
									as: 'person',
									attributes: ['fullName', 'dni'],
									required: Boolean(Object.keys(personWhere).length),
									where: Object.keys(personWhere).length
										? personWhere
										: undefined,
									paranoid: false,
								},
							],
							paranoid: false,
						},
					],
					order: [
						[
							sequelize.literal(
								'COALESCE("BillingModel"."effectiveDate", "BillingModel"."createdDate")',
							),
							'DESC',
						],
					],
					distinct: true,
					subQuery: false,
					limit: pageSize,
					offset,
				});

			const billingsWithPaymentMethods = billings
				.map(billing => {
					const billingJson = billing.toJSON();

					return {
						...billingJson,
						customerName: billingJson.customer?.person?.fullName ?? null,
						dni: billingJson.customer?.person?.dni ?? null,
						paymentMethods: [
							...new Set(
								billingJson.payments?.map((p: Payment) => p.paymentMethod) ||
									[],
							),
						],
					};
				})
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				.map(({ payments, customer, ...rest }) => rest);

			return {
				status: 200,
				data: {
					billings: billingsWithPaymentMethods,
					total,
					page,
					pageSize,
					totalPages: Math.ceil(total / pageSize),
				},
			};
		} catch (error) {
			console.error('Error obteniendo facturas');
			throw error;
		}
	};

	getOne = async (serialNumber: string) => {
		try {
			const billing = await this.billingModel.findOne({
				where: { serialNumber },
				attributes: [
					'id',
					'shopId',
					'serialNumber',
					'status',
					'discountType',
					'discount',
					'shipping',
					'comments',
					'customerId',
					[sequelize.col('customer.person.id'), 'personId'],
					[sequelize.col('customer.person.fullName'), 'fullName'],
					[sequelize.col('customer.person.dni'), 'dni'],
					[sequelize.col('customer.email'), 'email'],
					[sequelize.col('customer.phoneNumber'), 'phoneNumber'],
					[sequelize.col('customer.address.location'), 'location'],
					[sequelize.col('customer.city'), 'city'],
					[sequelize.col('customer.address.cityId'), 'cityId'],
					[sequelize.col('customer.address.city.name'), 'cityName'],
					[sequelize.col('customer.address.city.region.name'), 'regionName'],
					[sequelize.col('shop.country.isoCode'), 'countryIsoCode'],
					[sequelize.col('shop.country.callingCode'), 'callingCode'],
					[sequelize.col('shop.stock.id'), 'stockId'],
					'createdDate',
					'updatedDate',
				],
				include: [
					{
						model: this.billingPaymentModel,
						as: 'payments',
						attributes: ['paymentMethod', 'amount', 'createdDate'],
					},
					{
						model: CustomerModel,
						as: 'customer',
						attributes: [],
						include: [
							{
								model: PersonModel,
								as: 'person',
								attributes: [],
								paranoid: false,
							},
							{
								model: AddressModel,
								as: 'address',
								attributes: [],
								include: [
									{
										model: CityModel,
										as: 'city',
										attributes: [],
										include: [
											{
												model: RegionModel,
												as: 'region',
												attributes: [],
												include: [
													{
														model: CountryModel,
														as: 'country',
														attributes: [],
													},
												],
											},
										],
									},
								],
							},
						],
						paranoid: false,
					},
					{
						model: BillingItemModel,
						as: 'billingItems',
						required: true,
						attributes: [
							'id',
							'productVariantId',
							'name',
							'quantity',
							'price',
							'totalPrice',
						],
					},
					{
						model: ShopModel,
						as: 'shop',
						required: true,
						attributes: [],
						include: [
							{
								model: StockModel,
								as: 'stock',
								required: true,
								attributes: [],
							},
							{
								model: CountryModel,
								as: 'country',
								attributes: [],
							},
						],
					},
				],
			});
			if (!billing)
				return { status: 404, message: 'No fue posible obtener la factura' };

			const rawBilling = billing.toJSON();

			const formattedBilling = {
				...rawBilling,
				items: rawBilling.billingItems,
				paymentMethods: [
					...new Set(
						rawBilling.payments?.map((p: Payment) => p.paymentMethod) || [],
					),
				],
			};
			delete formattedBilling.billingItems;

			return {
				status: 200,
				billing: formattedBilling,
			};
		} catch (error) {
			console.error('Error obteniendo factura');
			throw error;
		}
	};

	create = async ({
		billingData,
		customerData,
	}: {
		billingData: CreateBillingDto;
		customerData: CreateCustomerDto;
	}) => {
		const transaction = await sequelize.transaction();
		try {
			const {
				shopId,
				stockId,
				currency,
				status,
				payments,
				discountType,
				discount,
				shipping,
				subtotal,
				comments,
				clientRequestId,
				requestedBy,
				balanceToUse,
				priceType,
			} = billingData;

			if (!shopId) {
				throw new Error('shopId es requerido para crear una factura');
			}

			if (!stockId) {
				throw new Error('stockId es requerido para crear una factura');
			}

			// Obtener tipo de precio por código (default PVP si no se especifica)
			const priceTypeCode = priceType || 'PVP';
			const priceTypeRecord = await PriceTypeModel.findOne({
				where: { code: priceTypeCode, isActive: true },
				transaction,
			});

			if (!priceTypeRecord) {
				throw new Error(
					`Tipo de precio ${priceTypeCode} no encontrado o inactivo`,
				);
			}

			const finalPriceTypeId = priceTypeRecord.id;

			const existing = await this.billingModel.findOne({
				where: { clientRequestId: billingData?.clientRequestId },
			});
			if (existing) {
				throw new Error('Ya se procesó esta solicitud');
			}

			if (billingData?.items?.length === 0) {
				throw new Error('Es necesario al menos 1 item para crear una factura');
			}

			if (discount > 0 && !discountType) {
				throw new Error(
					'El tipo de descuento es requerido cuando hay un descuento mayor a 0',
				);
			}

			let customerId = customerData?.customerId ?? null;

			if (
				customerData?.fullName &&
				customerData?.dni &&
				!customerData?.customerId
			) {
				const result = await this.customerService.create(
					customerData,
					transaction,
				);
				customerId = result.customer.id;
			} else if (customerId) {
				await this.customerService.update(customerData, transaction);
				const result = await this.customerService.getById(customerId);
				if (!result) throw new Error('El cliente está inactivo');
			}

			const deductFromStock = status === BillingStatus.PAID;

			// Crear factura *****
			const newBilling = this.billingModel.build({
				customerId,
				shopId,
				status,
				paymentMethod: payments?.[0]?.paymentMethod ?? PaymentMethod.OTHER,
				priceTypeId: finalPriceTypeId,
				discountType: discount > 0 && discountType ? discountType : null,
				discount: discount || 0,
				shipping,
				subtotal,
				comments,
				clientRequestId,
				createdBy: requestedBy,
				effectiveDate: deductFromStock ? new Date().toISOString() : null,
			});
			await newBilling.generateSerialNumber();
			await newBilling.save({ transaction });

			// Crear pagos *****
			const paymentEntries =
				payments?.length > 0
					? payments.map(payment => ({
							...payment,
							billingId: newBilling.id,
							paymentReference: payment?.paymentReference ?? null,
						}))
					: [];

			const createdPayments = await this.billingPaymentModel.bulkCreate(
				paymentEntries,
				{
					transaction,
					returning: true,
				},
			);

			// Usar saldo disponible del cliente si aplica *****
			const paymentsFromBalance: PaymentMethod[] = [];
			if (balanceToUse && Number(balanceToUse) > 0 && customerId) {
				// Obtener movimientos de crédito con saldo disponible (ordenados por fecha FIFO)
				const availableMovements =
					await this.customerBalanceService.getAvailableMovements(
						customerId,
						currency as 'USD' | 'COP',
						transaction,
					);

				// Crear pagos en billing_payment reflejando los métodos originales
				let remainingBalance = Number(balanceToUse);

				for (const movement of availableMovements) {
					if (remainingBalance <= 0) break;

					const amountToApply = Math.min(
						remainingBalance,
						Number(movement.availableAmount),
					);

					// Crear pago con método BALANCE
					const balancePayment = await this.billingPaymentModel.create(
						{
							billingId: newBilling.id,
							paymentMethod: PaymentMethod.BALANCE,
							amount: amountToApply,
							paymentReference: `Saldo a favor - ${
								movement.quoteId
									? `Cotización ${movement.quoteSerialNumber || movement.quoteId}`
									: 'Anticipo'
							}`,
						},
						{ transaction },
					);
					paymentsFromBalance.push(PaymentMethod.BALANCE);

					// Actualizar el movimiento de caja/transferencia con billingPaymentId y reference
					await this.customerBalanceService.updateMovementsWithBillingInfo(
						movement.id, // customerBalanceMovementId
						balancePayment.id,
						newBilling.serialNumber,
						transaction,
					);

					remainingBalance -= amountToApply;
				}

				// Registrar el uso del saldo
				await this.customerBalanceService.useBalance(
					{
						amount: balanceToUse,
						customerId,
						billingId: newBilling.id,
						currency: currency as 'USD' | 'COP',
						category: CustomerBalanceMovementCategory.PAYMENT_APPLIED,
						createdBy: requestedBy,
					},
					transaction,
				);
			}

			// Crear movimientos de caja *****
			for (const payment of createdPayments) {
				if (payment?.dataValues?.paymentMethod === PaymentMethod.CASH) {
					await this.cashMovementService.create(
						{
							shopId,
							billingPaymentId: payment?.dataValues?.id,
							reference: newBilling?.serialNumber,
							amount: Number(payment?.dataValues?.amount),
							type: 'INCOME',
							category: CashMovementCategory.SALE,
							createdBy: requestedBy,
						},
						transaction,
					);
				} else {
					await this.bankTransferMovementService.create(
						{
							shopId,
							billingPaymentId: payment?.dataValues?.id,
							reference: newBilling?.serialNumber,
							amount: Number(payment?.dataValues?.amount),
							type: 'INCOME',
							paymentMethod: payment?.dataValues?.paymentMethod,
							createdBy: billingData?.requestedBy,
						},
						transaction,
					);
				}
			}

			// Crear items de factura *****
			for (const item of billingData.items) {
				await this.billingItemService.create(
					{
						...item,
						id: undefined,
						productVariantId: item?.productVariantId,
						billingId: newBilling.id,
						stockId,
						currency: item.currency ?? billingData.currency,
						price: item.price,
						totalPrice: item.price * item.quantity,
					},
					deductFromStock,
					transaction,
				);
			}

			await transaction.commit();

			const RES_MESSAGES: Record<string, string> = {
				[BillingStatus.PAID]: 'Factura generada con éxito',
				[BillingStatus.PARTIAL_PAYMENT]: 'Abono generado con éxito',
				[BillingStatus.PENDING_DELIVERY]:
					'Pedido pendiente de entrega generado con éxito',
			};

			return {
				status: 201,
				newBilling: {
					id: newBilling.id,
					serialNumber: newBilling.serialNumber,
					status,
					paymentMethods: [
						...(payments?.map(p => p.paymentMethod) || []),
						...paymentsFromBalance,
					],
					subtotal,
					customerId,
					customerName: customerData?.fullName ?? null,
					dni: customerData?.dni ?? null,
					createdDate: newBilling.createdDate,
					shopId,
				},
				message: RES_MESSAGES[status],
			};
		} catch (error) {
			await transaction.rollback();
			console.error('Error creando factura');
			throw error;
		}
	};

	update = async (billingData: UpdateBillingDto, billingId: string) => {
		const transaction = await sequelize.transaction();
		try {
			const billingToUpdate = await this.billingModel.findByPk(billingId, {
				transaction,
			});

			if (!billingToUpdate) {
				throw new Error('Factura no encontrada');
			}

			if (billingToUpdate?.dataValues?.status === BillingStatus.PAID) {
				await billingToUpdate.update(
					{
						comments:
							billingData?.comments?.length > 0 ? billingData?.comments : null,
						updatedBy: billingData?.requestedBy,
					},
					{ transaction },
				);

				await transaction.commit();

				return {
					status: 200,
					billingUpdated: billingToUpdate.dataValues,
				};
			}

			const { subtotal, discountType, discount, shipping } =
				billingToUpdate.dataValues;

			const discountValue =
				discountType === DiscountType.PERCENTAGE
					? Number(subtotal) * (Number(discount) / 100)
					: Number(discount);

			const total =
				Math.round(
					(Number(subtotal) - discountValue + Number(shipping)) * 100,
				) / 100;

			const newPayment =
				billingData?.payments?.reduce(
					(sum, item) => sum + (Number(item.amount) || 0),
					0,
				) || 0;

			const existingPayment = await this.billingPaymentModel.sum('amount', {
				where: { billingId },
			});

			const totalPaid = newPayment + existingPayment;
			const paymentCompleted = totalPaid === total;

			await billingToUpdate.update(
				{
					status: billingData?.status,
					comments: billingData?.comments,
					updatedBy: billingData?.requestedBy,
				},
				{ transaction },
			);

			if (billingData?.payments?.length > 0) {
				const newPaymentEntries = billingData.payments.map(payment => ({
					...payment,
					billingId,
					paymentReference: payment.paymentReference || null,
				}));

				const createdPayments = await this.billingPaymentModel.bulkCreate(
					newPaymentEntries,
					{
						transaction,
					},
				);

				// Crear movimientos de caja *****
				for (const payment of createdPayments) {
					if (payment?.dataValues?.paymentMethod === PaymentMethod.CASH) {
						await this.cashMovementService.create(
							{
								shopId: billingToUpdate?.dataValues?.shopId,
								billingPaymentId: payment?.dataValues?.id,
								reference: billingToUpdate?.dataValues?.serialNumber,
								amount: Number(payment?.dataValues?.amount),
								type: 'INCOME',
								category: CashMovementCategory.SALE,
								createdBy: billingData?.requestedBy,
							},
							transaction,
						);
					} else {
						await this.bankTransferMovementService.create(
							{
								shopId: billingToUpdate?.dataValues?.shopId,
								billingPaymentId: payment?.dataValues?.id,
								reference: billingToUpdate?.dataValues?.serialNumber,
								amount: Number(payment?.dataValues?.amount),
								type: 'INCOME',
								paymentMethod: payment?.dataValues?.paymentMethod,
								createdBy: billingData?.requestedBy,
							},
							transaction,
						);
					}
				}
			}

			if (billingData?.status === BillingStatus.PAID && paymentCompleted) {
				// ⚠️ Se actualiza effectiveDate porque la factura impacta stock al pasar a PAID
				await billingToUpdate.update(
					{ effectiveDate: new Date().toISOString() },
					{ transaction },
				);
				// Esto asegura trazabilidad correcta en los movimientos de inventario ⚠️

				for (const billingItem of billingData.items) {
					await this.stockItemService.updateQuantity(
						{
							...billingItem,
							stockId: billingData?.stockId,
						},
						StockOperation.SUBTRACT,
						transaction,
					);
				}
			}

			await transaction.commit();

			const RES_MESSAGES: Record<string, string> = {
				[BillingStatus.PAID]: 'Factura generada con éxito',
				[BillingStatus.PARTIAL_PAYMENT]: 'Abono generado con éxito',
				[BillingStatus.PENDING_DELIVERY]:
					'Pedido pendiente de entrega generado con éxito',
			};

			return {
				status: 200,
				message: RES_MESSAGES[billingData?.status],
			};
		} catch (error) {
			await transaction.rollback();
			console.error('Error editando factura');
			throw error;
		}
	};

	cancel = async (serialNumber: string, updatedBy: string) => {
		const transaction = await sequelize.transaction();
		try {
			const { billing } = await this.getOne(serialNumber);

			if (!Array.isArray(billing.items) || billing.items.length === 0) {
				throw new Error('No hay ítems en la factura');
			}

			if (billing?.status === BillingStatus.PAID) {
				for (const item of billing.items) {
					await this.stockItemService.updateQuantity(
						{ ...item, stockId: billing?.stockId },
						StockOperation.ADD,
						transaction,
					);
				}
			}

			await this.billingModel.update(
				{ status: BillingStatus.CANCELED, updatedBy },
				{ where: { serialNumber }, transaction },
			);

			// Anular movimientos de caja *****
			await this.cashMovementService.cancel(
				serialNumber,
				updatedBy,
				transaction,
			);

			// Anular movimientos de transferencias bancarias *****
			await this.bankTransferMovementService.cancel(
				serialNumber,
				updatedBy,
				transaction,
			);

			// Revertir uso de balance del cliente *****
			await this.customerBalanceService.revertBalanceUsage(
				billing.id,
				transaction,
			);

			await transaction.commit();

			return {
				status: 200,
				message: 'Factura anulada con éxito',
			};
		} catch (error) {
			await transaction.rollback();
			console.error('Error anulando factura');
			throw error;
		}
	};
}
