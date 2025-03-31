import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { TransactionItemModel } from '../transaction-item/model';
import { StockModel } from '../stock/model';

export class TransactionModel extends Model {
	public type!: string;
	public supplierId!: string;
}

TransactionModel.init(
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
		state: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		type: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		fromId: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'stock',
				key: 'id',
			},
		},
		toId: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'stock',
				key: 'id',
			},
		},
		supplierId: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'supplier',
				key: 'id',
			},
		},
		shippingDate: {
			type: DataTypes.DATE,
			allowNull: true,
			defaultValue: sequelize.fn('now'),
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
		description: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: '',
		},
	},
	{
		sequelize,
		tableName: 'transaction',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
		indexes: [
			{
				name: 'PK_89eadb93a89810556e1cbcd6ab9',
				unique: true,
				fields: [{ name: 'id' }],
			},
		],
	},
);

// ***** TransactionModel-TransactionItemModel Relations *****
TransactionModel.hasMany(TransactionItemModel, {
	foreignKey: 'transactionId',
	as: 'transactionItems',
});

TransactionItemModel.belongsTo(TransactionModel, {
	foreignKey: 'transactionId',
	as: 'transaction',
});

// ***** TransactionModel-StockModel Relations *****
TransactionModel.belongsTo(StockModel, {
	foreignKey: 'fromId',
	as: 'stockFrom',
});

StockModel.hasMany(TransactionModel, {
	foreignKey: 'fromId',
	as: 'transactionsFrom',
});

TransactionModel.belongsTo(StockModel, {
	foreignKey: 'toId',
	as: 'stockTo',
});

StockModel.hasMany(TransactionModel, {
	foreignKey: 'toId',
	as: 'transactionsTo',
});
