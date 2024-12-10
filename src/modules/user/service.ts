import { sequelize } from '../../config/database';
import { RoleModel } from '../role/model';
import { PersonModel } from '../person/model';
import { UserModel } from './model';

export class UserService {
	private userModel;
	private personModel;
	private roleModel;

	constructor(userModel: typeof UserModel) {
		this.userModel = userModel;
		this.personModel = PersonModel;
		this.roleModel = RoleModel;
	}

	getAll = async () => {
		try {
			const users = await this.userModel.findAll({
				attributes: [
					'id',
					'personId',
					'email',
					'roleId',
					'isActive',
					'createdDate',
					[sequelize.col('person.fullName'), 'fullName'],
					[sequelize.col('person.dni'), 'docId'],
					[sequelize.col('role.name'), 'roleName'],
				],
				include: [
					{
						model: this.personModel,
						as: 'person',
						attributes: [],
					},
					{
						model: this.roleModel,
						as: 'role',
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
