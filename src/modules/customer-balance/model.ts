import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';

export class CustomerBalanceModel extends Model {
	public id!: string;
	public customerId!: string;
	public currency!: 'COP' | 'USD';
	public balance!: number;
	public createdDate!: Date;
	public updatedDate!: Date;
}

CustomerBalanceModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		customerId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'customer',
				key: 'id',
			},
		},
		currency: {
			type: DataTypes.ENUM('COP', 'USD'),
			allowNull: false,
		},
		balance: {
			type: DataTypes.DECIMAL(15, 2),
			allowNull: false,
			defaultValue: 0,
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
	},
	{
		sequelize,
		tableName: 'customer_balance',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		indexes: [
			{
				name: 'PK_customer_balance_id',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'UQ_customer_balance_customer_currency',
				unique: true,
				fields: [{ name: 'customerId' }, { name: 'currency' }],
			},
		],
	},
);
