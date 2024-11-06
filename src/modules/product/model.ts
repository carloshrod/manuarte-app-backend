import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { ProductCategoryModel } from '../product-category/model';
import { ProductVariantModel } from '../product-variant/model';
import { Op } from 'sequelize';
import { CustomCreateOptions } from '../types';

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
				throw new Error('Categoría no encontrada');
			}

			const cId = categoryProduct.cId;

			// Buscar el último pId con el prefijo de cId
			const maxItem = await ProductModel.findOne({
				where: { pId: { [Op.like]: `${cId}%` } },
				order: [['pId', 'DESC']],
			});

			let nextId = `${cId}0001`;

			if (maxItem) {
				const currentId = maxItem.pId.slice(cId.length);
				const nextNumericId = parseInt(currentId, 10) + 1;
				nextId = cId + nextNumericId.toString().padStart(4, '0');
			}

			this.pId = nextId;
		} catch (error) {
			console.error('Error generando pId: ', error);
			throw error;
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
		hooks: {
			beforeValidate: async (product, options: CustomCreateOptions) => {
				await product.generatePId();

				const submittedBy = options.submittedBy;
				if (submittedBy) {
					product.createdBy = submittedBy;
					product.updatedBy = submittedBy;
				}
			},
			beforeUpdate: (product, options: CustomCreateOptions) => {
				const submittedBy = options.submittedBy;
				if (submittedBy) {
					product.updatedBy = submittedBy;
				}
			},
		},
	},
);

// ***** ProductModel-ProductCategoryModel Relations *****
ProductModel.belongsTo(ProductCategoryModel, {
	foreignKey: 'categoryProductId',
	as: 'categoryProduct',
	targetKey: 'id',
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
