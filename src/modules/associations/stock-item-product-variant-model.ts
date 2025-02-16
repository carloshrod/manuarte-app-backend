import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';

export class StockItemProductVariantModel extends Model {}

StockItemProductVariantModel.init(
	{
		stockItemId: {
			type: DataTypes.UUID,
			allowNull: false,
			primaryKey: true,
			references: {
				model: 'stock_item',
				key: 'id',
			},
		},
		productVariantId: {
			type: DataTypes.UUID,
			allowNull: false,
			primaryKey: true,
			references: {
				model: 'product_variant',
				key: 'id',
			},
		},
	},
	{
		sequelize,
		tableName: 'stock_item_product_variant',
		schema: 'public',
		timestamps: false,
	},
);
