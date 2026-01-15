import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { StockItemModel } from '../stock-item/model';
import { PriceTypeModel } from '../price-type/model';

export class StockItemPriceModel extends Model {
	public id!: string;
	public stockItemId!: string;
	public priceTypeId!: string;
	public price!: number;
	public createdDate!: Date;
	public updatedDate!: Date;
}

StockItemPriceModel.init(
	{
		id: {
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		stockItemId: {
			type: DataTypes.UUID,
			allowNull: false,
		},
		priceTypeId: {
			type: DataTypes.UUID,
			allowNull: false,
		},
		price: {
			type: DataTypes.DECIMAL(15, 2),
			allowNull: false,
		},
		createdDate: {
			type: DataTypes.DATE,
			defaultValue: sequelize.fn('now'),
		},
		updatedDate: {
			type: DataTypes.DATE,
			defaultValue: sequelize.fn('now'),
		},
	},
	{
		sequelize,
		tableName: 'stock_item_price',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
	},
);

// Relaciones
StockItemPriceModel.belongsTo(StockItemModel, {
	foreignKey: 'stockItemId',
	as: 'stockItem',
});

StockItemPriceModel.belongsTo(PriceTypeModel, {
	foreignKey: 'priceTypeId',
	as: 'priceType',
});

StockItemModel.hasMany(StockItemPriceModel, {
	foreignKey: 'stockItemId',
	as: 'prices',
});

PriceTypeModel.hasMany(StockItemPriceModel, {
	foreignKey: 'priceTypeId',
	as: 'stockItemPrices',
});
