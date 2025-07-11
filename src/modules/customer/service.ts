import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import { CustomError } from '../../middlewares/errorHandler';
import { AddressModel } from '../address/model';
import { PersonModel } from '../person/model';
import { CustomerModel } from './model';
import { CreateCustomerDto, UpdateCustomerDto } from './types';
import { Op } from 'sequelize';
import { BillingModel } from '../billing/model';
import { BillingStatus, Payment } from '../billing/types';
import { QuoteModel } from '../quote/model';
import { QuoteStatus } from '../quote/types';
import { ShopModel } from '../shop/model';
import { BillingItemModel } from '../billing-item/model';
import { CityModel } from '../city/model';
import { RegionModel } from '../region/model';
import { CountryModel } from '../country/model';
import { CityService } from '../city/service';
import { BillingPaymentModel } from '../billing-payment/model';

export class CustomerService {
	private customerModel;
	private personModel;
	private addressModel;
	private cityService;

	constructor(customerModel: typeof CustomerModel) {
		this.customerModel = customerModel;
		this.personModel = PersonModel;
		this.addressModel = AddressModel;
		this.cityService = new CityService(CityModel);
	}

	getAll = async (isoCode?: string) => {
		try {
			if (isoCode && typeof isoCode !== 'string') {
				throw new Error('Invalid isoCode');
			}

			const filterByCountry = Boolean(isoCode);

			const customers = await this.customerModel.findAll({
				attributes: [
					'id',
					'personId',
					'email',
					'phoneNumber',
					'createdDate',
					'city',
					[sequelize.col('person.fullName'), 'fullName'],
					[sequelize.col('person.dni'), 'dni'],
					[sequelize.col('address.location'), 'location'],
					[sequelize.col('address.cityId'), 'cityId'],
					[sequelize.col('address.city.name'), 'cityName'],
					[sequelize.col('address.city.region.name'), 'regionName'],
					[
						sequelize.col('address.city.region.country.isoCode'),
						'countryIsoCode',
					],
				],
				include: [
					{
						model: this.personModel,
						as: 'person',
						attributes: [],
					},
					{
						model: this.addressModel,
						as: 'address',
						attributes: [],
						required: filterByCountry,
						include: [
							{
								model: CityModel,
								as: 'city',
								attributes: [],
								required: filterByCountry,
								include: [
									{
										model: RegionModel,
										as: 'region',
										attributes: [],
										required: filterByCountry,
										include: [
											{
												model: CountryModel,
												as: 'country',
												attributes: [],
												required: filterByCountry,
												where: filterByCountry ? { isoCode } : undefined,
											},
										],
									},
								],
							},
						],
					},
				],
			});

			return customers;
		} catch (error) {
			console.error('ServiceError obteniendo clientes: ', error);
			throw error;
		}
	};

	create = async (
		customerData: CreateCustomerDto,
		transaction?: Transaction,
	) => {
		const localTransaction = transaction || (await sequelize.transaction());
		try {
			const { fullName, dni, ...restCustomer } = customerData;
			const person = await this.personModel.create(
				{ fullName, dni },
				{ transaction: localTransaction },
			);

			const { email, phoneNumber } = restCustomer;
			const customer = await this.customerModel.create(
				{
					email: email?.length > 0 ? email : undefined,
					phoneNumber,
					personId: person.id,
				},
				{ transaction: localTransaction },
			);

			if (restCustomer?.location) {
				await this.addressModel.create(
					{
						location: restCustomer?.location,
						customerId: customer.id,
						cityId: restCustomer?.cityId,
					},
					{ transaction: localTransaction },
				);
			}

			const cityInfo = await this.cityService.getById(restCustomer?.cityId);

			if (!transaction) await localTransaction.commit();

			return {
				status: 201,
				customer: {
					id: customer.id,
					personId: person.id,
					cityName: cityInfo?.dataValues?.name,
					regionName: cityInfo?.dataValues?.regionName,
					countryIsoCode: cityInfo?.dataValues?.countryIsoCode,
					...customerData,
				},
			};
		} catch (error) {
			if (!transaction) await localTransaction.rollback();
			console.error('***************** Error creando customer: ');
			if (
				error instanceof Error &&
				(error as CustomError).parent?.code === '23505'
			) {
				error.message = 'Ya existe un cliente con este número de documento';
			}
			throw error;
		}
	};

	update = async (
		customerData: UpdateCustomerDto,
		transaction?: Transaction,
	) => {
		const localTransaction = transaction || (await sequelize.transaction());
		try {
			const { personId, ...rest } = customerData;

			const personToUpdate = await this.personModel.findByPk(personId, {
				transaction: localTransaction,
			});
			const customerToUpdate = await this.customerModel.findOne({
				where: { personId },
				transaction: localTransaction,
			});
			if (!personToUpdate || !customerToUpdate) {
				throw new Error('Usuario no encontrado');
			}

			const { fullName, dni, email, phoneNumber, location, cityId } = rest;

			await personToUpdate.update(
				{ fullName, dni },
				{ transaction: localTransaction },
			);
			await customerToUpdate.update(
				{
					email: email?.length > 0 ? email : undefined,
					phoneNumber,
				},
				{ transaction: localTransaction },
			);

			const [updatedCount] = await this.addressModel.update(
				{ location, cityId },
				{
					where: { customerId: customerToUpdate.id },
					transaction: localTransaction,
				},
			);

			if (updatedCount === 0) {
				await this.addressModel.create(
					{
						location,
						customerId: customerToUpdate.id,
						cityId,
					},
					{ transaction: localTransaction },
				);
			}

			const cityInfo = await this.cityService.getById(cityId);

			if (!transaction) await localTransaction.commit();

			return {
				status: 200,
				updatedCustomer: {
					...customerData,
					cityName: cityInfo?.dataValues?.name,
					regionName: cityInfo?.dataValues?.regionName,
					countryIsoCode: cityInfo?.dataValues?.countryIsoCode,
					id: customerToUpdate.id,
				},
			};
		} catch (error) {
			if (!transaction) await localTransaction.rollback();
			console.error('***************** Error editando customer: ');
			if (
				error instanceof Error &&
				(error as CustomError).parent?.code === '23505'
			) {
				error.message = 'Ya existe un cliente con este número de documento';
			}
			throw error;
		}
	};

	delete = async (personId: string) => {
		const transaction = await sequelize.transaction();
		try {
			await this.personModel.destroy({ where: { id: personId }, transaction });

			const customerDeleted = await this.customerModel.destroy({
				where: { personId },
				transaction,
			});

			if (customerDeleted === 1) {
				await transaction.commit();
				return { status: 200, message: 'Cliente eliminado con éxito' };
			}

			throw new Error('Usuario no encontrado');
		} catch (error) {
			await transaction.rollback();
			console.error(error);
			throw error;
		}
	};

	getCustomerById = async (id: string) => {
		try {
			const customer = await this.customerModel.findByPk(id);

			return customer;
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	getStats = async (id: string) => {
		try {
			const customerInfo = await this.customerModel.findOne({
				where: { id },
				attributes: [
					'id',
					'personId',
					'email',
					'phoneNumber',
					'createdDate',
					'city',
					[sequelize.col('person.fullName'), 'fullName'],
					[sequelize.col('person.dni'), 'dni'],
					[sequelize.col('address.location'), 'location'],
					[sequelize.col('address.cityId'), 'cityId'],
					[sequelize.col('address.city.name'), 'cityName'],
					[sequelize.col('address.city.region.name'), 'regionName'],
					[
						sequelize.col('address.city.region.country.isoCode'),
						'countryIsoCode',
					],
				],
				include: [
					{
						model: this.personModel,
						as: 'person',
						attributes: [],
					},
					{
						model: this.addressModel,
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
			});

			const billings = await BillingModel.findAndCountAll({
				where: { customerId: id, status: BillingStatus.PAID },
				attributes: [
					'serialNumber',
					'discount',
					'shipping',
					[
						sequelize.literal(`(
							SELECT COALESCE(SUM("totalPrice"::numeric), 0)
							FROM "billing_item" AS bi
							WHERE 
								bi."billingId" = "BillingModel"."id" 
								AND bi."name" NOT ILIKE '%flete%'
						)`),
						'subtotal',
					],
					'createdDate',
				],
				include: [
					{
						model: BillingPaymentModel,
						as: 'payments',
						attributes: ['paymentMethod'],
					},
				],
				order: [['createdDate', 'DESC']],
				distinct: true,
			});

			const billingsWithPaymentMethods = billings.rows
				.map(billing => {
					const billingJson = billing.toJSON();

					return {
						...billingJson,
						paymentMethods:
							billingJson.payments?.map((p: Payment) => p.paymentMethod) || [],
					};
				})
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				.map(({ payments, ...rest }) => rest);

			const [result] = await sequelize.query<{
				totalSpent: string | null;
			}>(
				`
				SELECT SUM("totalPrice") AS "totalSpent"
				FROM "billing_item" bi
				INNER JOIN "billing" b ON b.id = bi."billingId"
				WHERE 
					b."customerId" = :customerId 
					AND b."status" = 'PAID' 
					AND bi."name" NOT ILIKE '%flete%'
				`,
				{
					replacements: { customerId: id },
					type: QueryTypes.SELECT,
				},
			);
			const totalSpent = result.totalSpent || 0;

			const topProducts = await sequelize.query<{
				productVariantId: string;
				name: string;
				totalQty: number;
			}>(
				`
				SELECT 
					bi."productVariantId",
					MAX(bi."name") AS "name",
					SUM(bi."quantity") AS "totalQty"
				FROM "billing_item" bi
				INNER JOIN "billing" b ON b.id = bi."billingId"
				WHERE 
					b."customerId" = :customerId 
					AND b."status" = 'PAID' 
					AND bi."name" NOT ILIKE '%flete%'
				GROUP BY bi."productVariantId"
				ORDER BY "totalQty" DESC
				LIMIT 5
				`,
				{
					replacements: { customerId: id },
					type: QueryTypes.SELECT,
				},
			);

			const quotes = await QuoteModel.findAndCountAll({
				where: { customerId: id, status: QuoteStatus.PENDING },
				attributes: [
					'serialNumber',
					'shipping',
					[
						sequelize.literal(`(
							SELECT COALESCE(SUM("totalPrice"::numeric), 0)
							FROM "quote_item" AS qi
							WHERE 
								qi."quoteId" = "QuoteModel"."id" 
								AND qi."name" NOT ILIKE '%flete%'
						)`),
						'subtotal',
					],
					'createdDate',
				],
				order: [['createdDate', 'DESC']],
			});

			return {
				status: 200,
				customer: {
					info: customerInfo,
					billings: { rows: billingsWithPaymentMethods, count: billings.count },
					totalSpent,
					topProducts,
					quotes,
				},
			};
		} catch (error) {
			console.error('Error getting customer history: ', error);
			throw error;
		}
	};

	getTop = async (limit: number) => {
		try {
			let topCol;
			let topEcu;

			for (const currency of ['COP', 'USD']) {
				const topCustomers = await this.customerModel.findAll({
					attributes: [
						'id',
						'personId',
						'email',
						'phoneNumber',
						'createdDate',
						'city',
						[sequelize.col('person.fullName'), 'fullName'],
						[sequelize.col('person.dni'), 'dni'],
						[sequelize.col('address.location'), 'location'],
						[sequelize.col('address.cityId'), 'cityId'],
						[sequelize.col('address.city.name'), 'cityName'],
						[sequelize.col('address.city.region.name'), 'regionName'],
						[
							sequelize.col('address.city.region.country.isoCode'),
							'countryIsoCode',
						],
						[
							sequelize.fn(
								'COUNT',
								sequelize.literal('DISTINCT "billings"."id"'),
							),
							'billingCount',
						],
						[
							sequelize.fn(
								'SUM',
								sequelize.col('"billings->billingItems"."totalPrice"'),
							),
							'totalSpent',
						],
					],
					include: [
						{
							model: BillingModel,
							as: 'billings',
							required: true,
							attributes: [],
							where: { status: BillingStatus.PAID },
							include: [
								{
									model: BillingItemModel,
									as: 'billingItems',
									required: true,
									attributes: [],
									where: {
										name: { [Op.notILike]: '%flete%' },
									},
								},
								{
									model: ShopModel,
									as: 'shop',
									required: true,
									attributes: [],
									where: { currency },
								},
							],
						},
						{
							model: this.personModel,
							as: 'person',
							attributes: [],
						},
						{
							model: this.addressModel,
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
					group: [
						'CustomerModel.id',
						'person.fullName',
						'person.dni',
						'address.location',
						'address.cityId',
						'address.city.name',
						'address.city.region.name',
						'address.city.region.country.isoCode',
					],
					order: [[sequelize.literal('"billingCount"'), 'DESC']],
					subQuery: false,
				});

				if (currency === 'COP') {
					topCol = topCustomers;
				} else if (currency === 'USD') {
					topEcu = topCustomers;
				}
			}

			return { status: 200, topCustomers: { col: topCol, ecu: topEcu } };
		} catch (error) {
			console.error('Error getting top customers: ', error);
			throw error;
		}
	};

	searchCustomer = async (search: string, isoCode: string) => {
		try {
			const customer = await this.personModel.findAll({
				where: {
					[Op.or]: [
						{ dni: { [Op.iLike]: `%${search}%` } },
						{ fullName: { [Op.iLike]: `%${search}%` } },
					],
				},
				attributes: [
					'id',
					[sequelize.col('customer.id'), 'customerId'],
					'dni',
					'fullName',
					[sequelize.col('customer.email'), 'email'],
					[sequelize.col('customer.phoneNumber'), 'phoneNumber'],
					[sequelize.col('customer.address.location'), 'location'],
					[sequelize.col('customer.city'), 'city'],
					[sequelize.col('customer.address.cityId'), 'cityId'],
					[sequelize.col('customer.address.city.name'), 'cityName'],
					[sequelize.col('customer.address.city.region.name'), 'regionName'],
					[
						sequelize.col('customer.address.city.region.country.isoCode'),
						'countryIsoCode',
					],
				],
				include: [
					{
						model: this.customerModel,
						as: 'customer',
						required: true,
						attributes: [],
						include: [
							{
								model: this.addressModel,
								as: 'address',
								attributes: [],
								required: true,
								include: [
									{
										model: CityModel,
										as: 'city',
										attributes: [],
										required: true,
										include: [
											{
												model: RegionModel,
												as: 'region',
												attributes: [],
												required: true,
												include: [
													{
														model: CountryModel,
														as: 'country',
														attributes: [],
														required: true,
														where: { isoCode },
													},
												],
											},
										],
									},
								],
							},
						],
					},
				],
			});

			const formattedCustomer = customer.map(item => {
				const itemFormatted = {
					personId: item?.id,
					...item?.dataValues,
				};
				delete itemFormatted.id;
				return itemFormatted;
			});

			return {
				status: 200,
				customer: formattedCustomer,
			};
		} catch (error) {
			console.error(error);
			throw error;
		}
	};
}
