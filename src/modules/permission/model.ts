import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';

export class PermissionModel extends Model {
	public id!: string;
	public name!: string;
}

PermissionModel.init(
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
			unique: 'UQ_c81ee3c195bc1cb233f69c9e904',
		},
		description: {
			type: DataTypes.STRING,
			allowNull: true,
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
		tableName: 'permission',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
		indexes: [
			{
				name: 'PK_2391da0f3ffdb3315e96908b776',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'UQ_c81ee3c195bc1cb233f69c9e904',
				unique: true,
				fields: [{ name: 'name' }],
			},
		],
	},
);
