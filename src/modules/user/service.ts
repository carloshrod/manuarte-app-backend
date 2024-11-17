import { sequelize } from '../../config/database';
import { PartModel } from '../part/model';
import { PersonModel } from '../person/model';
import { UserModel } from './model';

export class UserService {
	private userModel;
	private personModel;
	private partModel;

	constructor(userModel: typeof UserModel) {
		this.userModel = userModel;
		this.personModel = PersonModel;
		this.partModel = PartModel;
	}

	getAll = async () => {
		try {
			const users = await this.userModel.findAll({
				attributes: [
					'id',
					'personId',
					'email',
					'permitPartId',
					'isActive',
					'createdDate',
					[sequelize.col('person.fullName'), 'fullName'],
					[sequelize.col('person.dni'), 'docId'],
					[sequelize.col('permitPart.name'), 'permitName'],
				],
				include: [
					{
						model: this.personModel,
						as: 'person',
						attributes: [],
					},
					{
						model: this.partModel,
						as: 'permitPart',
						attributes: [],
					},
				],
			});

			return users;
		} catch (error) {
			console.error('ServiceError obteniendo usuarios:', error);
			throw error;
		}
	};
}
