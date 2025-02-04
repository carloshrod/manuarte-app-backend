import { sequelize } from '../../config/database';
import { AddressModel } from '../address/model';
import { CustomerModel } from '../customer/model';
import { CustomerService } from '../customer/service';
import { CreateCustomerDto, UpdateCustomerDto } from '../customer/types';
import { PersonModel } from '../person/model';
import { QuoteItemModel } from '../quote-item/model';
import { QuoteItemService } from '../quote-item/service';
import { ShopModel } from '../shop/model';
import { QuoteModel } from './model';
import { CreateQuoteDto, UpdateQuoteDto } from './types';

export class QuoteService {
	private quoteModel;
	private quoteItemService;
	private customerService;

	constructor(quoteModel: typeof QuoteModel) {
		this.quoteModel = quoteModel;
		this.quoteItemService = new QuoteItemService(QuoteItemModel);
		this.customerService = new CustomerService(CustomerModel);
	}

	getAll = async (shopSlug: string) => {
		try {
			const shop = await ShopModel.findOne({ where: { slug: shopSlug } });
			if (!shop)
				return { status: 404, message: 'No fue posible encontrar la tienda' };

			const quotes = await this.quoteModel.findAll({
				where: { shopId: shop.id },
				attributes: [
					'id',
					'serialNumber',
					'status',
					'customerId',
					[sequelize.col('customer.person.fullName'), 'customerName'],
					'updatedDate',
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

			return { status: 200, quotes };
		} catch (error) {
			console.error('Error obteniendo cotizaciones');
			throw error;
		}
	};

	getOne = async (serialNumber: string) => {
		try {
			const quote = await this.quoteModel.findOne({
				where: { serialNumber },
				attributes: [
					'id',
					'shopId',
					'serialNumber',
					'status',
					'currency',
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
						model: QuoteItemModel,
						as: 'quoteItems',
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
			if (!quote)
				return { status: 404, message: 'No fue posible obtener la cotización' };

			const formattedQuote = {
				...quote.toJSON(),
				items: quote.get('quoteItems'),
			};
			delete formattedQuote.quoteItems;

			return {
				status: 200,
				quote: formattedQuote,
			};
		} catch (error) {
			console.error('Error obteniendo cotización');
			throw error;
		}
	};

	create = async ({
		quoteData,
		customerData,
	}: {
		quoteData: CreateQuoteDto;
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

			const { status, shipping, shopSlug, requestedBy } = quoteData;

			const shop = await ShopModel.findOne({
				where: { slug: shopSlug },
				attributes: ['id', 'currency'],
			});
			if (!shop) {
				return { status: 400, message: 'Parece que la tienda no existe!' };
			}

			const newQuote = this.quoteModel.build({
				customerId,
				shopId: shop.id,
				status,
				currency: shop.currency,
				shipping,
				createdBy: requestedBy,
			});
			await newQuote.generateSerialNumber();
			await newQuote.save({ transaction });

			for (const item of quoteData.items) {
				await this.quoteItemService.create(
					{
						...item,
						id: undefined,
						productVariantId: item?.productVariantId,
						quoteId: newQuote.id,
					},
					transaction,
				);
			}

			await transaction.commit();

			return {
				status: 201,
				newQuote: {
					id: newQuote.id,
					serialNumber: newQuote.serialNumber,
					status,
					customerId,
					customerName: customerData?.fullName ?? null,
					shopId: shop.id,
					updatedDate: newQuote.updatedDate,
				},
			};
		} catch (error) {
			await transaction.rollback();
			console.error('Error creando cotización');
			throw error;
		}
	};

	update = async ({
		quoteData,
		customerData,
	}: {
		quoteData: UpdateQuoteDto;
		customerData: UpdateCustomerDto;
	}) => {
		try {
			let customerInfo;
			if (customerData?.personId) {
				customerInfo = await this.customerService.update(customerData);
				if (!customerInfo)
					return {
						status: 400,
						message: 'Cliente no encontrado',
					};
			}

			const quoteToUpdate = await this.quoteModel.findByPk(quoteData.id);
			if (!quoteToUpdate)
				return {
					status: 400,
					message: 'Cotización no encontrada',
				};

			await quoteToUpdate.update({
				customerId: customerData?.customerId,
				status: quoteData?.status,
				currency: quoteData?.currency,
				shipping: quoteData?.shipping,
				requestedBy: quoteData?.requestedBy,
				updatedDate: sequelize.fn('now'),
			});

			if (quoteData?.items?.length > 0) {
				await this.quoteItemService.updateItems(quoteData?.items, quoteData.id);
			} else {
				return {
					status: 400,
					message: 'La cotización debe tener al menos 1 item',
				};
			}

			return {
				status: 200,
				updatedQuote: {
					id: quoteData?.id,
					serialNumber: quoteToUpdate?.serialNumber,
					status: quoteData?.status,
					customerId: customerData?.customerId,
					customerName: customerData?.fullName,
					shopId: quoteData?.shopId,
					updatedDate: quoteToUpdate?.updatedDate,
				},
			};
		} catch (error) {
			console.error('Error actualizando cotización');
			throw error;
		}
	};

	delete = async (id: string) => {
		try {
			const result = await this.quoteModel.destroy({ where: { id } });

			if (result === 1) {
				return { status: 200, message: 'Cotización eliminada con éxito' };
			}

			return { status: 404, message: 'Cotización no encontrada' };
		} catch (error) {
			console.error('Error eliminando cotización');
			throw error;
		}
	};
}
