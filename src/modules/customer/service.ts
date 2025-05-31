import { QueryTypes, Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import { CustomError } from '../../middlewares/errorHandler';
import { AddressModel } from '../address/model';
import { PersonModel } from '../person/model';
import { CustomerModel } from './model';
import { CreateCustomerDto, UpdateCustomerDto } from './types';
import { Op } from 'sequelize';
import { BillingModel } from '../billing/model';
import { BillingStatus } from '../billing/types';
import { QuoteModel } from '../quote/model';
import { QuoteStatus } from '../quote/types';
import { ShopModel } from '../shop/model';
import { BillingItemModel } from '../billing-item/model';

export class CustomerService {
	private customerModel;
	private personModel;
	private addressModel;

	constructor(customerModel: typeof CustomerModel) {
		this.customerModel = customerModel;
		this.personModel = PersonModel;
		this.addressModel = AddressModel;
	}

	getAll = async () => {
		try {
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

			const { email, phoneNumber, city } = restCustomer;
			const customer = await this.customerModel.create(
				{
					email: email?.length > 0 ? email : undefined,
					phoneNumber,
					city,
					personId: person.id,
				},
				{ transaction: localTransaction },
			);

			if (restCustomer?.location) {
				await this.addressModel.create(
					{
						location: restCustomer?.location,
						customerId: customer.id,
					},
					{ transaction: localTransaction },
				);
			}

			if (!transaction) await localTransaction.commit();

			return {
				status: 201,
				customer: {
					id: customer.id,
					personId: person.id,
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

			const { fullName, dni, email, phoneNumber, city, location } = rest;

			await personToUpdate.update(
				{ fullName, dni },
				{ transaction: localTransaction },
			);
			await customerToUpdate.update(
				{
					email: email?.length > 0 ? email : undefined,
					phoneNumber,
					city,
				},
				{ transaction: localTransaction },
			);
			await this.addressModel.update(
				{ location },
				{
					where: { customerId: customerToUpdate.id },
					transaction: localTransaction,
				},
			);

			if (!transaction) await localTransaction.commit();

			return {
				status: 200,
				updatedCustomer: { ...customerData, id: customerToUpdate.id },
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
					},
				],
			});

			const billings = await BillingModel.findAndCountAll({
				where: { customerId: id, status: BillingStatus.PAID },
				attributes: [
					'serialNumber',
					'paymentMethod',
					'total',
					'shipping',
					'createdDate',
				],
				order: [['createdDate', 'DESC']],
			});

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
						'total',
					],
					'createdDate',
				],
				order: [['createdDate', 'DESC']],
			});

			return {
				status: 200,
				customer: {
					info: customerInfo,
					billings,
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
						},
					],
					group: [
						'CustomerModel.id',
						'person.fullName',
						'person.dni',
						'address.location',
					],
					order: [[sequelize.literal('"billingCount"'), 'DESC']],
					limit,
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

	searchCustomer = async (search: string) => {
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
