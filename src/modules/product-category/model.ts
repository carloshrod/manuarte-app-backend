import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database';

export const ProductCategoryModel = sequelize.define(
	'category_product',
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
		cId: {
			type: DataTypes.STRING(4),
			allowNull: false,
			unique: 'UQ_5fd8cbca48258162717427d403a',
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
		tableName: 'category_product',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'PK_f132cc7be455c359ba84d1e7246',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'UQ_5fd8cbca48258162717427d403a',
				unique: true,
				fields: [{ name: 'cId' }],
			},
		],
	},
);
