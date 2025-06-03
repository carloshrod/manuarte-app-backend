import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { RegionModel } from '../region/model';

export class CountryModel extends Model {}

CountryModel.init(
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
			unique: 'UQ_a3ef25bff86c640040b4ada0a8d',
		},
		currency: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		callingCode: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: 'UQ_a3ef25bff86c640040b4ada0a8d',
		},
		isoCode: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: 'UQ_a3ef25bff86c640040b4ada0a8d',
		},
		utcTimezone: {
			type: DataTypes.STRING,
			allowNull: false,
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
		tableName: 'country',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
	},
);

CountryModel.hasMany(RegionModel, {
	foreignKey: 'countryId',
	as: 'regions',
});

RegionModel.belongsTo(CountryModel, {
	foreignKey: 'countryId',
	as: 'country',
});
