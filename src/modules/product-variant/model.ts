import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { ProductModel } from '../product/model';
import { Op } from 'sequelize';
import { CustomCreateOptions } from '../types';

export class ProductVariantModel extends Model {
	public productId!: string;
	public vId!: string;
	public createdBy!: string;
	public updatedBy!: string;

	async generateVId() {
		try {
			const product = await ProductModel.findByPk(this.productId);

			if (!product) {
				throw new Error('Producto no encontrado');
			}

			const pId = product?.pId;

			// Buscar el último vId con el prefijo de pId
			const maxItem = await ProductVariantModel.findOne({
				where: { vId: { [Op.like]: `${pId}%` } },
				order: [['vId', 'DESC']],
			});

			let nextId = `${pId}0001`;

			if (maxItem) {
				const currentId = maxItem.vId.slice(pId?.length);
				const nextNumericId = parseInt(currentId, 10) + 1;
				nextId = pId + nextNumericId.toString().padStart(4, '0');
			}

			this.vId = nextId;
		} catch (error) {
			console.error('Error generando vId: ', error);
			throw error;
		}
	}
}

ProductVariantModel.init(
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
			defaultValue: 0,
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
		sequelize,
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
		hooks: {
			beforeValidate: async (productVariant, options: CustomCreateOptions) => {
				await productVariant.generateVId();

				const submittedBy = options.submittedBy;
				if (submittedBy) {
					productVariant.createdBy = submittedBy;
					productVariant.updatedBy = submittedBy;
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
