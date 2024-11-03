import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database';

export const ProductVariantModel = sequelize.define(
	'variant_product',
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
		quantity: {
			type: DataTypes.INTEGER,
			allowNull: false,
		},
		productId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'product',
				key: 'id',
			},
		},
		vId: {
			type: DataTypes.STRING(12),
			allowNull: false,
			unique: 'UQ_d7fc664d6233f126e71d2bcf367',
		},
		createdBy: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		updatedBy: {
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
		tableName: 'variant_product',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'PK_738bfa62f918ad1436cb5c8ee5b',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'UQ_d7fc664d6233f126e71d2bcf367',
				unique: true,
				fields: [{ name: 'vId' }],
			},
		],
	},
);
