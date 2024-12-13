import { sequelize } from '../../config/database';
import { AddressModel } from '../address/model';
import { PersonModel } from '../person/model';
import { CustomerModel } from './model';
import { CreateCustomerDto, UpdateCustomerDto } from './types';

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
					[sequelize.col('person.dni'), 'docId'],
				],
				include: [
					{
						model: this.personModel,
						as: 'person',
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

	create = async (customerData: CreateCustomerDto) => {
		const transaction = await sequelize.transaction();
		try {
			const { fullName, dni, email, phoneNumber, city, location } =
				customerData;

			const person = await this.personModel.create(
				{ fullName, dni },
				{ transaction },
			);
			const customer = await this.customerModel.create(
				{
					email,
					phoneNumber,
					city,
					personId: person.id,
				},
				{ transaction },
			);
			await this.addressModel.create(
				{ location, customerId: customer.id },
				{ transaction },
			);

			await transaction.commit();

			return {
				status: 201,
				customer: {
					id: customer.id,
					personId: person.id,
					...customerData,
				},
			};
		} catch (error) {
			console.error(error);
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
				updatedCustomer: customerData,
			};
		} catch (error) {
			await transaction.rollback();
			console.error(error);
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
}
