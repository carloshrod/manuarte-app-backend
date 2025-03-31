import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { AddressModel } from '../address/model';

export class CityModel extends Model {}

CityModel.init(
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
		},
		provinceId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'province',
				key: 'id',
			},
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
		tableName: 'city',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
		indexes: [
			{
				name: 'PK_b222f51ce26f7e5ca86944a6739',
				unique: true,
				fields: [{ name: 'id' }],
			},
		],
	},
);

CityModel.hasMany(AddressModel, {
	foreignKey: 'cityId',
	as: 'address',
});

AddressModel.belongsTo(CityModel, {
	foreignKey: 'cityId',
	as: 'city',
});
