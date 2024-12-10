import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { PermissionModel } from '../permission/model';
import { RolePermissionModel } from '../role-permission/model';

export class RoleModel extends Model {}

RoleModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: 'UQ_a5362eb271179ceec5304917d0d',
		},
		createdDate: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: sequelize.fn('now'),
		},
		updatedDate: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: sequelize.fn('now'),
		},
		deletedDate: {
			type: DataTypes.DATE,
			allowNull: true,
		},
	},
	{
		sequelize,
		tableName: 'role',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'PK_58888debdf048d2dfe459aa59da',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'UQ_a5362eb271179ceec5304917d0d',
				unique: true,
				fields: [{ name: 'name' }],
			},
		],
	},
);

RoleModel.belongsToMany(PermissionModel, {
	through: RolePermissionModel,
	as: 'permissions',
	foreignKey: 'roleId',
	otherKey: 'permissionId',
});

PermissionModel.belongsToMany(RoleModel, {
	through: RolePermissionModel,
	as: 'roles',
	foreignKey: 'permissionId',
	otherKey: 'roleId',
});
