import { sequelize } from '../../config/database';
import { RoleModel } from '../role/model';
import { PersonModel } from '../person/model';
import { UserModel } from './model';
import { CreateUserDto, SetPermissionsDto, UpdateUserDto } from './types';
import { PermissionModel } from '../permission/model';
import { Op } from 'sequelize';

export class UserService {
	private userModel;
	private personModel;
	private roleModel;
	private permissionModel;

	constructor(userModel: typeof UserModel) {
		this.userModel = userModel;
		this.personModel = PersonModel;
		this.roleModel = RoleModel;
		this.permissionModel = PermissionModel;
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
					[sequelize.col('person.dni'), 'dni'],
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
					{
						model: this.permissionModel,
						as: 'extraPermissions',
						attributes: ['id', 'name'],
						through: { attributes: [] },
					},
				],
			});

			return users;
		} catch (error) {
			console.error('ServiceError obteniendo usuarios:', error);
			throw error;
		}
	};

	getRoles = async () => {
		try {
			const roles = await this.roleModel.findAll({
				attributes: ['id', 'name'],
			});
			if (roles.length === 0) return { status: 204 };

			return { status: 200, roles };
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	register = async (userData: CreateUserDto) => {
		const transaction = await sequelize.transaction();
		try {
			const { fullName, dni, roleId, email, password } = userData;
			const person = await this.personModel.create(
				{ fullName, dni },
				{ transaction },
			);
			if (!person) return { status: 500, message: 'Error creando usuario' };

			const user = await this.userModel.create(
				{ roleId, email, password, personId: person.id },
				{ transaction },
			);
			if (!user) return { status: 500, message: 'Error creando usuario' };

			const userRegistered = {
				id: user.id,
				email,
				roleId,
				roleName: await this.getRoleName(roleId),
				personId: person.id,
				fullName,
				dni,
			};

			await transaction.commit();

			return {
				status: 201,
				userRegistered,
				message: 'Usuario registrado con éxito',
			};
		} catch (error) {
			await transaction.rollback();
			console.error(error);
			throw error;
		}
	};

	update = async (userData: UpdateUserDto) => {
		const transaction = await sequelize.transaction();
		try {
			const { personId, userId, ...rest } = userData;

			const personToUpdate = await this.personModel.findByPk(personId);
			const userToUpdate = await this.userModel.findByPk(userId);
			if (!userToUpdate || !personToUpdate) {
				return { status: 404, message: 'Usuario no encontrado' };
			}

			const { fullName, dni, roleId, email, password } = rest;
			await personToUpdate.update({ fullName, dni }, { transaction });
			await userToUpdate.update({ roleId, email, password }, { transaction });

			const updatedUser = {
				id: userToUpdate.id,
				email,
				roleId,
				roleName: await this.getRoleName(roleId),
				personId: personToUpdate.id,
				fullName,
				dni,
			};

			await transaction.commit();

			return {
				status: 200,
				updatedUser,
				message: 'Usuario actualizado con éxito',
			};
		} catch (error) {
			await transaction.rollback();
			console.error(error);
			throw error;
		}
	};

	delete = async (personId: string) => {
		try {
			const userDeleted = await this.personModel.destroy({
				where: { id: personId },
			});

			if (userDeleted === 1) {
				return { status: 200, message: 'Usuario eliminado con éxito' };
			}

			return { status: 404, message: 'Usuario no encontrado' };
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	setPermissions = async ({ userId, extraPermissions }: SetPermissionsDto) => {
		try {
			const user = await this.userModel.findByPk(userId);
			if (!user) {
				return { status: 404, message: 'Usuario no encontrado' };
			}

			await user.setExtraPermissions(extraPermissions);

			return {
				status: 200,
				message:
					extraPermissions.length === 0
						? 'Permisos eliminados con éxito'
						: 'Permisos actualizados con éxito',
			};
		} catch (error) {
			console.error(error);
			return {
				status: 500,
				message: 'Error asignando permisos de usuario',
			};
		}
	};

	getAssignablePermissions = async (userId: string) => {
		try {
			const user = await this.userModel.findByPk(userId);
			if (!user) return { status: 404, message: 'Usuario no encontrado' };
			const roleName = await this.getRoleName(user.roleId);
			if (roleName !== 'cajero') {
				return { status: 204, assignablePermissions: [] };
			}

			const ITEMS_PERMISSIONS_BY_ROLE = {
				cajero: ['product', 'customer'], // Items por los que se le puede asignar permisos al usuario con rol = cajero
			};

			const permissionConditions =
				ITEMS_PERMISSIONS_BY_ROLE[roleName].length > 0
					? ITEMS_PERMISSIONS_BY_ROLE[roleName].map(permission => ({
							[Op.iLike]: `%${permission}%`,
						}))
					: null;

			const assignablePermissions = await this.permissionModel.findAll({
				where: {
					name: {
						[Op.or]: permissionConditions,
					},
				},
				attributes: ['id', 'name'],
			});

			return { status: 200, assignablePermissions };
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	private getRoleName = async (id: string) => {
		try {
			const role = await this.roleModel.findByPk(id, {
				attributes: ['name'],
			});
			if (!role) throw new Error('Rol no encontrado');

			return role.name;
		} catch (error) {
			console.error(error);
			throw error;
		}
	};
}
