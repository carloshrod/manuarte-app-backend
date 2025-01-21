import { Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import { CustomError } from '../../middlewares/errorHandler';
import { AddressModel } from '../address/model';
import { PersonModel } from '../person/model';
import { CustomerModel } from './model';
import { CreateCustomerDto, UpdateCustomerDto } from './types';
import { Op } from 'sequelize';

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
					email,
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

	update = async (customerData: UpdateCustomerDto) => {
		const transaction = await sequelize.transaction();
		try {
			const { personId, ...rest } = customerData;

			const personToUpdate = await this.personModel.findByPk(personId);
			const customerToUpdate = await this.customerModel.findOne({
				where: { personId },
			});
			if (!personToUpdate || !customerToUpdate) {
				return { status: 404, message: 'Usuario no encontrado' };
			}

			const { fullName, dni, email, phoneNumber, city, location } = rest;

			await personToUpdate.update({ fullName, dni }, { transaction });
			await customerToUpdate.update(
				{ email, phoneNumber, city },
				{ transaction },
			);
			await this.addressModel.update(
				{ location },
				{ where: { customerId: customerToUpdate.id }, transaction },
			);

			await transaction.commit();

			return {
				status: 200,
				updatedCustomer: { ...customerData, id: customerToUpdate.id },
			};
		} catch (error) {
			await transaction.rollback();
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
		try {
			const customerDeleted = await this.personModel.destroy({
				where: { id: personId },
			});

			if (customerDeleted === 1) {
				return { status: 200, message: 'Cliente eliminado con éxito' };
			}

			throw new Error('Usuario no encontrado');
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	getCustomerById = async (id: string) => {
		try {
			const customer = await this.customerModel.findByPk(id);
			if (!customer) throw new Error('Cliente no encontrado');

			return customer;
		} catch (error) {
			console.error(error);
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
