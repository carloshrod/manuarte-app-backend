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
	public productCategoryId!: string;
	public createdBy!: string;
	public updatedBy!: string;

	async generatePId() {
		try {
			const productCategory = await ProductCategoryModel.findByPk(
				this.productCategoryId,
			);

			if (!productCategory) {
				throw new Error(
					`Categoría con ID ${this.productCategoryId} no encontrada`,
				);
			}

			const cId = productCategory.cId;

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

	async validateProductName() {
		const existingProduct = await ProductModel.findOne({
			where: sequelize.where(
				sequelize.fn('LOWER', sequelize.col('name')),
				this.name.toLowerCase(),
			),
		});

		if (existingProduct && existingProduct.id !== this.id) {
			throw new Error(
				'Ya existe un producto con este nombre (Ten en cuenta mayúsculas y minúsculas)',
			);
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
		productCategoryId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'product_category',
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
		hooks: {
			beforeCreate: async product => {
				product.name = product.name.trim();
				await product.validateProductName();
			},
			beforeUpdate: async product => {
				product.name = product.name.trim();
				await product.validateProductName();
				if (product.changed('productCategoryId')) {
					throw new Error(
						'No se permite actualizar la categoría del producto una vez creado',
					);
				}
			},
		},
	},
);

// ***** ProductModel-ProductCategoryModel Relations *****
ProductModel.belongsTo(ProductCategoryModel, {
	foreignKey: 'productCategoryId',
	as: 'productCategory',
});

ProductCategoryModel.hasMany(ProductModel, {
	foreignKey: 'productCategoryId',
	as: 'products',
});

// ***** ProductModel-ProductVariantModel Relations *****
ProductModel.hasMany(ProductVariantModel, {
	foreignKey: 'productId',
	as: 'productVariants',
});

ProductVariantModel.belongsTo(ProductModel, {
	foreignKey: 'productId',
	as: 'product',
});
