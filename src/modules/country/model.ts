import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { ProvinceModel } from '../province/model';

export class CountryModel extends Model {}

CountryModel.init(
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
			unique: 'UQ_a3ef25bff86c640040b4ada0a8d',
		},
		language: {
			type: DataTypes.STRING,
			allowNull: false,
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
		indexes: [
			{
				name: 'PK_bf6e37c231c4f4ea56dcd887269',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'UQ_a3ef25bff86c640040b4ada0a8d',
				unique: true,
				fields: [
					{ name: 'name' },
					{ name: 'callingCode' },
					{ name: 'isoCode' },
				],
			},
		],
	},
);

CountryModel.hasMany(ProvinceModel, {
	foreignKey: 'countryId',
	as: 'provinces',
});

ProvinceModel.belongsTo(CountryModel, {
	foreignKey: 'countryId',
	as: 'country',
});
