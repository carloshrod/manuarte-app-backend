import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { CityModel } from '../city/model';

export class RegionModel extends Model {}

RegionModel.init(
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
		regionCode: {
			type: DataTypes.STRING(3),
			allowNull: false,
			unique: true,
		},
		countryId: {
			type: DataTypes.INTEGER,
			allowNull: false,
			references: {
				model: 'country',
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
		tableName: 'region',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
	},
);

RegionModel.hasMany(CityModel, {
	foreignKey: 'regionId',
	as: 'cities',
});

CityModel.belongsTo(RegionModel, {
	foreignKey: 'regionId',
	as: 'region',
});
