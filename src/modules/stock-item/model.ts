import { DataTypes, Model, Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import { ProductVariantModel } from '../product-variant/model';
import { StockItemProductVariantModel } from '../associations/stock-item-product-variant-model';

export class StockItemModel extends Model {
	public quantity!: string;

	public addProductVariant!: (
		productVariant: ProductVariantModel | string,
		options?: { transaction: Transaction },
	) => Promise<ProductVariantModel>;
}

StockItemModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		currency: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		price: {
			type: DataTypes.DECIMAL,
			allowNull: false,
		},
		quantity: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		isSubjectToVAT: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		stockId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'stock',
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
		cost: {
			type: DataTypes.DECIMAL,
			allowNull: false,
			defaultValue: 0,
		},
		minQty: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		maxQty: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
	},
	{
		sequelize,
		tableName: 'stock_item',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
		indexes: [
			{
				name: 'PK_0b51047279d22d97442d46dfee8',
				unique: true,
				fields: [{ name: 'id' }],
			},
		],
	},
);

StockItemModel.belongsToMany(ProductVariantModel, {
	through: StockItemProductVariantModel,
	as: 'productVariants',
	foreignKey: 'stockItemId',
	otherKey: 'productVariantId',
	onDelete: 'CASCADE',
});

ProductVariantModel.belongsToMany(StockItemModel, {
	through: StockItemProductVariantModel,
	as: 'stockItems',
	foreignKey: 'productVariantId',
	otherKey: 'stockItemId',
	onDelete: 'CASCADE',
});
