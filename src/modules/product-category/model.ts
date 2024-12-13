import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { Op } from 'sequelize';

export class ProductCategoryModel extends Model {
	public id!: string;
	public cId!: string;
	public name!: string;

	async generateCId() {
		try {
			const lastCategory = await ProductCategoryModel.findOne({
				where: { cId: { [Op.not]: null } },
				order: [['cId', 'DESC']],
			});

			let nextCId = '0001';

			if (lastCategory && lastCategory.cId) {
				const lastCIdNumeric = parseInt(lastCategory.cId, 10);

				if (isNaN(lastCIdNumeric)) {
					throw new Error(
						`Formato de cId inválido en la última categoría: ${lastCategory.cId}`,
					);
				}

				const nextNumericId = lastCIdNumeric + 1;
				nextCId = nextNumericId.toString().padStart(4, '0');
			}

			this.cId = nextCId;
		} catch (error) {
			console.error('Error generando el cId:', error);
			throw new Error(
				'No se pudo generar un nuevo cId para la categoría de producto',
			);
		}
	}

	async validateProductCategoryName() {
		const existingProduct = await ProductCategoryModel.findOne({
			where: { name: this.name },
		});

		if (existingProduct && existingProduct.id !== this.id) {
			throw new Error('Ya existe una categoría de producto con este nombre');
		}
	}
}

ProductCategoryModel.init(
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
		sequelize,
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
		hooks: {
			beforeCreate: async productCategory => {
				productCategory.name = productCategory.name.toUpperCase().trim();
				await productCategory.validateProductCategoryName();
			},
			beforeUpdate: async productCategory => {
				productCategory.name = productCategory.name.toUpperCase().trim();
				await productCategory.validateProductCategoryName();
			},
		},
	},
);
