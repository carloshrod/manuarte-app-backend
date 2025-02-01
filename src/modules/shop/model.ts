import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { StockModel } from '../stock/model';

export class ShopModel extends Model {
	public id!: string;
	public slug!: string;
	public currency!: string;
}

ShopModel.init(
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
		slug: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: true,
		},
		tax: {
			type: DataTypes.DOUBLE,
			allowNull: false,
			defaultValue: 0.15,
		},
		currency: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: "COP",
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
		tableName: 'shop',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'PK_ad47b7c6121fe31cb4b05438e44',
				unique: true,
				fields: [{ name: 'id' }],
			},
		],
	},
);

ShopModel.hasOne(StockModel, {
	foreignKey: 'shopId',
	as: 'stock',
});

StockModel.belongsTo(ShopModel, {
	foreignKey: 'shopId',
	as: 'shop',
});
