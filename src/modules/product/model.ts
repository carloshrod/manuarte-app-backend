import { DataTypes } from 'sequelize';
import { sequelize } from '../../config/database';
import { ProductCategoryModel } from '../product-category/model';
import { ProductVariantModel } from '../product-variant/model';

export const ProductModel = sequelize.define(
	'product',
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
		description: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		pId: {
			type: DataTypes.STRING(8),
			allowNull: false,
			unique: 'UQ_60968f56bca6403ae5387658832',
		},
		categoryProductId: {
			type: DataTypes.UUID,
			allowNull: false,
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
		tableName: 'product',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'PK_bebc9158e480b949565b4dc7a82',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'UQ_60968f56bca6403ae5387658832',
				unique: true,
				fields: [{ name: 'pId' }],
			},
		],
	},
);

ProductModel.belongsTo(ProductCategoryModel, {
	foreignKey: 'categoryProductId',
	as: 'categoryProduct',
	targetKey: 'id',
});

ProductModel.hasMany(ProductVariantModel, {
	foreignKey: 'productId',
	as: 'variantProduct',
	sourceKey: 'id',
});
