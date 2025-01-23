import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';

export class BillingItemModel extends Model {
	public name!: string;
	public productVariantId!: string;
}

BillingItemModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		billingId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'billing',
				key: 'id',
			},
		},
		currency: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		productVariantId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'product_variant',
				key: 'id',
			},
		},
		name: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		quantity: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		price: {
			type: DataTypes.DECIMAL,
			allowNull: true,
		},
		tax: {
			type: DataTypes.DECIMAL,
			allowNull: true,
		},
		totalPrice: {
			type: DataTypes.DECIMAL,
			allowNull: true,
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
		tableName: 'billing_item',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'PK_cd7d33c1c91b479709adc5328b2',
				unique: true,
				fields: [{ name: 'id' }],
			},
		],
	},
);
