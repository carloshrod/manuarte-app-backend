import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { AddressModel } from '../address/model';

export class CityModel extends Model {}

CityModel.init(
	{
		id: {
			type: DataTypes.INTEGER,
			primaryKey: true,
			autoIncrement: true,
			allowNull: false,
			unique: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		regionId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			references: {
				model: 'region',
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
