import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { ProductCategoryModel } from '../product-category/model';
import { ProductVariantModel } from '../product-variant/model';
import { Op } from 'sequelize';

export class ProductModel extends Model {
	public id!: string;
	public name!: string;
	public pId!: string;
	public description!: string;
	public categoryProductId!: string;
	public createdBy!: string;
	public updatedBy!: string;

	async generatePId() {
		try {
			const categoryProduct = await ProductCategoryModel.findByPk(
				this.categoryProductId,
			);

			if (!categoryProduct) {
				throw new Error(
					`Categoría con ID ${this.categoryProductId} no encontrada`,
				);
			}

			const cId = categoryProduct.cId;

			const lastProduct = await ProductModel.findOne({
				where: { pId: { [Op.like]: `${cId}%` } },
				order: [['pId', 'DESC']],
			});

			let nextPId = `${cId}0001`;

			if (lastProduct) {
				const currentId = lastProduct.pId.slice(cId.length);
				const nextNumericId = parseInt(currentId, 10) + 1;

				if (isNaN(nextNumericId)) {
					throw new Error(
						`Formato de pId inválido en el último producto: ${lastProduct.pId}`,
					);
				}

				nextPId = `${cId}${nextNumericId.toString().padStart(4, '0')}`;
			}

			this.pId = nextPId;
		} catch (error) {
			console.error('Error generando pId:', error);
			throw new Error('No se pudo generar un nuevo pId para el producto');
		}
	}
}

ProductModel.init(
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
			references: {
				model: 'category_product',
				key: 'id',
			},
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
		sequelize,
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

// ***** ProductModel-ProductCategoryModel Relations *****
ProductModel.belongsTo(ProductCategoryModel, {
	foreignKey: 'categoryProductId',
	as: 'categoryProduct',
	targetKey: 'id',
});

ProductCategoryModel.hasMany(ProductModel, {
	foreignKey: 'categoryProductId',
	as: 'products',
	sourceKey: 'id',
});

// ***** ProductModel-ProductVariantModel Relations *****
ProductModel.hasMany(ProductVariantModel, {
	foreignKey: 'productId',
	as: 'variantProduct',
	sourceKey: 'id',
});

ProductVariantModel.belongsTo(ProductModel, {
	foreignKey: 'productId',
	as: 'product',
	targetKey: 'id',
});
