import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';

export class UserPermissionModel extends Model {}

UserPermissionModel.init(
	{
		userId: {
			type: DataTypes.UUID,
			allowNull: false,
			primaryKey: true,
			references: {
				model: 'user',
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
		tableName: 'user_permission',
		schema: 'public',
		timestamps: false,
	},
);
