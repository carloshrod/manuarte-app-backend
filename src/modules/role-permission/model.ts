import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';

export class RolePermissionModel extends Model {}

RolePermissionModel.init(
	{
		roleId: {
			type: DataTypes.UUID,
			allowNull: false,
			primaryKey: true,
			references: {
				model: 'role',
				key: 'id',
			},
		},
		permissionId: {
			type: DataTypes.UUID,
			allowNull: false,
			primaryKey: true,
			references: {
				model: 'permission',
				key: 'id',
			},
		},
	},
	{
		sequelize,
		tableName: 'role_permission',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'IDX_19355980fc6b1fbfb40619b81c',
				fields: [{ name: 'permissionId' }],
			},
			{
				name: 'IDX_66b33244d5e2579f554b7a9e7f',
				fields: [{ name: 'roleId' }],
			},
			{
				name: 'PK_ab8d964d12e46804f088a34db6f',
				unique: true,
				fields: [{ name: 'roleId' }, { name: 'permissionId' }],
			},
		],
	},
);
