import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { CreateQuoteItemDto } from './types';

export class QuoteItemModel extends Model<CreateQuoteItemDto> {
	public id!: string;
}

QuoteItemModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		quoteId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'quote',
				key: 'id',
			},
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
		currency: {
			type: DataTypes.STRING,
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
		tableName: 'quote_item',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'PK_5fef8c6ee2b65633efff895181f',
				unique: true,
				fields: [{ name: 'id' }],
			},
		],
	},
);
