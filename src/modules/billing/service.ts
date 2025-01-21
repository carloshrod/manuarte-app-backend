import { CreateCustomerDto } from './../customer/types';
import { BillingStatus, CreateBillingDto } from './types';
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

export class BillingService {
	private billingModel;
	private billingItemService;
	private customerService;

	constructor(billingModel: typeof BillingModel) {
		this.billingModel = billingModel;
		this.billingItemService = new BillingItemService(BillingItemModel);
		this.customerService = new CustomerService(CustomerModel);
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
					'updatedDate',
					'customerId',
					[sequelize.col('customer.person.fullName'), 'customerName'],
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
							},
						],
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
							},
							{
								model: AddressModel,
								as: 'address',
								attributes: [],
							},
						],
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
			let customerId = customerData?.customerId ?? null;
			if (customerData?.fullName && !customerData?.customerId) {
				const result = await this.customerService.create(
					customerData,
					transaction,
				);
				customerId = result.customer.id;
			}

			const { shopSlug, status, paymentMethod, shipping, total, requestedBy } =
				billingData;
			const shopId = shopSlug && (await this.getShopId(shopSlug));

			const newBilling = this.billingModel.build({
				customerId,
				shopId,
				status,
				paymentMethod,
				shipping,
				total,
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
						shopId,
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
					customerId,
					customerName: customerData?.fullName ?? null,
					updatedDate: newBilling.updatedDate,
					shopId,
				},
			};
		} catch (error) {
			await transaction.rollback();
			console.error('Error creando factura');
			throw error;
		}
	};

	cancel = async (serialNumber: string) => {
		const transaction = await sequelize.transaction();
		try {
			const result = await this.getOne(serialNumber);

			for (const item of result.billing.items) {
				await this.billingItemService.cancel({
					billingItemData: item,
					shopId: result.billing.shopId,
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

	private getShopId = async (shopSlug: string) => {
		try {
			const shop = await ShopModel.findOne({
				where: { slug: shopSlug },
				attributes: ['id', [sequelize.col('stock.id'), 'stockId']],
				include: [
					{
						model: StockModel,
						as: 'stock',
						attributes: [],
					},
				],
			});
			if (!shop) {
				throw new Error('Parece que la tienda no existe');
			}

			return shop.id;
		} catch (error) {
			console.error('Error obteniendo id de la tienda');
			throw error;
		}
	};
}
