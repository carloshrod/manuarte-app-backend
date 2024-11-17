import { sequelize } from '../../config/database';
import { PersonModel } from '../person/model';
import { CustomerModel } from './model';

export class CustomerService {
	private customerModel;
	private personModel;

	constructor(customerModel: typeof CustomerModel) {
		this.customerModel = customerModel;
		this.personModel = PersonModel;
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
}
