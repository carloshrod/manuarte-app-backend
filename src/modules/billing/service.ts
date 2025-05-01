import { CreateCustomerDto } from './../customer/types';
import { BillingStatus, CreateBillingDto, UpdateBillingDto } from './types';
import { sequelize } from '../../config/database';
import { CustomerModel } from '../customer/model';
import { PersonModel } from '../person/model';
import { ShopModel } from '../shop/model';
import { BillingModel } from './model';
import { CustomerService } from '../customer/service';
import { BillingItemService } from '../billing-item/service';
import { BillingItemModel } from '../billing-item/model';
import { AddressModel } from '../address/model';
import { ShopService } from '../shop/service';
import { StockModel } from '../stock/model';

export class BillingService {
	private billingModel;
	private billingItemService;
	private customerService;
	private shopService;

	constructor(billingModel: typeof BillingModel) {
		this.billingModel = billingModel;
		this.billingItemService = new BillingItemService(BillingItemModel);
		this.customerService = new CustomerService(CustomerModel);
		this.shopService = new ShopService(ShopModel);
	}

	getAll = async (shopSlug: string) => {
		try {
			const shop = await ShopModel.findOne({ where: { slug: shopSlug } });
			if (!shop)
				return { status: 404, message: 'No fue posible encontrar la tienda' };

			const billings = await this.billingModel.findAll({
				where: { shopId: shop.id },
				attributes: [
					'id',
					'serialNumber',
					'status',
					'paymentMethod',
					'total',
					'createdDate',
					'updatedDate',
					'customerId',
					[sequelize.col('customer.person.fullName'), 'customerName'],
					[sequelize.col('customer.person.dni'), 'dni'],
					'shopId',
				],
				include: [
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
						],
						paranoid: false,
					},
				],
				order: [['createdDate', 'DESC']],
			});

			return { status: 200, billings };
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
					'paymentMethod',
					'shipping',
					'customerId',
					[sequelize.col('customer.person.id'), 'personId'],
					[sequelize.col('customer.person.fullName'), 'fullName'],
					[sequelize.col('customer.person.dni'), 'dni'],
					[sequelize.col('customer.email'), 'email'],
					[sequelize.col('customer.phoneNumber'), 'phoneNumber'],
					[sequelize.col('customer.address.location'), 'location'],
					[sequelize.col('customer.city'), 'city'],
					[sequelize.col('shop.stock.id'), 'stockId'],
					'createdDate',
					'updatedDate',
				],
				include: [
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
							},
						],
						paranoid: false,
					},
					{
						model: BillingItemModel,
						as: 'billingItems',
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
						attributes: [],
						include: [
							{
								model: StockModel,
								as: 'stock',
								attributes: [],
							},
						],
					},
				],
			});
			if (!billing)
				return { status: 404, message: 'No fue posible obtener la factura' };

			const formattedBilling = {
				...billing.toJSON(),
				items: billing.get('billingItems'),
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
			if (billingData?.items?.length === 0) {
				throw new Error('Es necesario al menos 1 item para crear una factura');
			}

			let customerId = customerData?.customerId ?? null;

			if (customerData?.fullName && !customerData?.customerId) {
				const result = await this.customerService.create(
					customerData,
					transaction,
				);
				customerId = result.customer.id;
			} else if (customerId) {
				const result = await this.customerService.getCustomerById(customerId);
				if (!result) throw new Error('El cliente está inactivo');
			}

			const { shopSlug, status, paymentMethod, shipping, total, requestedBy } =
				billingData;

			const shop = shopSlug && (await this.shopService.getOneBySlug(shopSlug));
			if (!shop) {
				await transaction.rollback();
				return { status: 400, message: 'Tienda no encontrada' };
			}

			const newBilling = this.billingModel.build({
				customerId,
				shopId: shop?.dataValues?.id,
				status,
				paymentMethod,
				shipping,
				total: Number(total) - Number(shipping ?? 0),
				createdBy: requestedBy,
			});
			await newBilling.generateSerialNumber();
			await newBilling.save({ transaction });

			for (const item of billingData.items) {
				await this.billingItemService.create(
					{
						...item,
						id: undefined,
						productVariantId: item?.productVariantId,
						billingId: newBilling.id,
						stockId: shop?.dataValues?.stockId,
						currency: item.currency ?? billingData.currency,
					},
					transaction,
				);
			}

			await transaction.commit();

			return {
				status: 201,
				newBilling: {
					id: newBilling.id,
					serialNumber: newBilling.serialNumber,
					status,
					paymentMethod,
					total: newBilling.total,
					customerId,
					customerName: customerData?.fullName ?? null,
					dni: customerData?.dni ?? null,
					createdDate: newBilling.createdDate,
					shopId: shop?.dataValues?.id,
				},
			};
		} catch (error) {
			await transaction.rollback();
			console.error('Error creando factura');
			throw error;
		}
	};

	update = async (billingData: UpdateBillingDto, billingId: string) => {
		try {
			const billingToUpdate = await this.billingModel.findByPk(billingId);
			if (!billingToUpdate)
				return {
					status: 400,
					message: 'Factura no encontrada',
				};

			await billingToUpdate.update(billingData);

			return { status: 200 };
		} catch (error) {
			console.error('Error editando factura');
			throw error;
		}
	};

	cancel = async (serialNumber: string) => {
		const transaction = await sequelize.transaction();
		try {
			const result = await this.getOne(serialNumber);

			if (
				!Array.isArray(result.billing.items) ||
				result.billing.items.length === 0
			) {
				throw new Error('No hay ítems en la factura');
			}

			for (const item of result.billing.items) {
				await this.billingItemService.cancel({
					billingItemData: item,
					stockId: result.billing.stockId,
					transaction,
				});
			}

			await this.billingModel.update(
				{ status: BillingStatus.CANCELED },
				{ where: { serialNumber }, transaction },
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

	delete = async (id: string) => {
		try {
			const result = await this.billingModel.destroy({ where: { id } });

			if (result === 1) {
				return { status: 200, message: 'Factura eliminada con éxito' };
			}

			return { status: 404, message: 'Factura no encontrada' };
		} catch (error) {
			console.error('Error eliminando factura');
			throw error;
		}
	};
}
