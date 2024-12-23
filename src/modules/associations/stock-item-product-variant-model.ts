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
		indexes: [
			{
				name: 'IDX_1825c09609b74b94c85ee80479',
				fields: [{ name: 'productVariantId' }],
			},
			{
				name: 'IDX_3db6597e069dc420336c1015e2',
				fields: [{ name: 'stockItemId' }],
			},
			{
				name: 'PK_5dc7a4916988fb951017e39a115',
				unique: true,
				fields: [{ name: 'stockItemId' }, { name: 'productVariantId' }],
			},
		],
	},
);
