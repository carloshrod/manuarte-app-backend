import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';

export class AddressModel extends Model {}

AddressModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		location: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		postalCode: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		cityId: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'city',
				key: 'id',
			},
		},
		customerId: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'customer',
				key: 'id',
			},
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
		tableName: 'address',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
		indexes: [
			{
				name: 'PK_d92de1f82754668b5f5f5dd4fd5',
				unique: true,
				fields: [{ name: 'id' }],
			},
		],
	},
);
