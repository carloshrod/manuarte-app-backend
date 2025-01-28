import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { Op } from 'sequelize';
import { QuoteItemModel } from '../quote-item/model';

export class QuoteModel extends Model {
	public id!: string;
	public serialNumber!: string;
	public updatedDate!: string;

	async generateSerialNumber() {
		try {
			const serialNumberLength = 18;
			const lastQuote = await QuoteModel.findOne({
				where: { id: { [Op.not]: null } },
				order: [['serialNumber', 'DESC']],
				paranoid: false,
			});

			if (lastQuote) {
				const lastNumber = parseInt(lastQuote.serialNumber, 10);
				const newNumber = lastNumber + 1;

				this.serialNumber = newNumber
					.toString()
					.padStart(serialNumberLength, '0');
			} else {
				this.serialNumber = '1'.padStart(serialNumberLength, '0');
			}
		} catch (error) {
			console.error('Error generando número serial de cotización');
			throw error;
		}
	}
}

QuoteModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		serialNumber: {
			type: DataTypes.STRING(20),
			allowNull: false,
			unique: 'UQ_e51788e04b800dc0990d0bce836',
		},
		customerId: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'customer',
				key: 'id',
			},
		},
		shopId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'shop',
				key: 'id',
			},
		},
		status: {
			type: DataTypes.ENUM(
				'ACCEPTED',
				'PENDING',
				'CANCELED',
				'REVISION',
				'OVERDUE',
			),
			allowNull: false,
		},
		currency: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		shipping: {
			type: DataTypes.INTEGER,
			allowNull: true,
		},
		createdBy: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'user',
				key: 'id',
			},
		},
		updatedBy: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'user',
				key: 'id',
			},
		},
		dueDate: {
			type: DataTypes.DATE,
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
		tableName: 'quote',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'PK_75c20205845608fdb6725d7b130',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'UQ_e51788e04b800dc0990d0bce836',
				unique: true,
				fields: [{ name: 'serialNumber' }],
			},
		],
	},
);

QuoteModel.hasMany(QuoteItemModel, {
	foreignKey: 'quoteId',
	as: 'quoteItems',
});

QuoteItemModel.belongsTo(QuoteModel, {
	foreignKey: 'quoteId',
	as: 'quote',
});
