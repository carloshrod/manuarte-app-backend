import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { CityModel } from '../city/model';

export class ProvinceModel extends Model {}

ProvinceModel.init(
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
		countryId: {
			type: DataTypes.UUID,
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
		tableName: 'province',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'PK_4f461cb46f57e806516b7073659',
				unique: true,
				fields: [{ name: 'id' }],
			},
		],
	},
);

ProvinceModel.hasMany(CityModel, {
	foreignKey: 'provinceId',
	as: 'cities',
});

CityModel.belongsTo(ProvinceModel, {
	foreignKey: 'provinceId',
	as: 'province',
});
