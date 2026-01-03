import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';

export class CustomerBalanceMovementModel extends Model {
	public id!: string;
	public customerId!: string;
	public quoteId?: string;
	public billingId!: string | null;
	public type!: 'CREDIT' | 'DEBIT';
	public category!:
		| 'ADVANCE_PAYMENT'
		| 'REFUND'
		| 'PAYMENT_APPLIED'
		| 'ADJUSTMENT'
		| 'OTHER';
	public paymentMethod?:
		| 'CASH'
		| 'BANK_TRANSFER'
		| 'BANK_TRANSFER_RT'
		| 'BANK_TRANSFER_RBT'
		| 'DEBIT_CARD'
		| 'CREDIT_CARD'
		| 'NEQUI'
		| 'BOLD'
		| 'EFECTY'
		| 'WOMPI'
		| 'PAYPHONE'
		| 'PAYPAL'
		| 'BANK_DEPOSIT'
		| 'OTHER'
		| null;
	public currency!: 'COP' | 'USD';
	public amount!: number;
	public balanceBefore!: number;
	public balanceAfter!: number;
	public comments!: string | null;
	public createdBy!: string;
	public createdDate!: Date;
}

CustomerBalanceMovementModel.init(
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
		quoteId: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'quote',
				key: 'id',
			},
		},
		billingId: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'billing',
				key: 'id',
			},
		},
		type: {
			type: DataTypes.ENUM('CREDIT', 'DEBIT'),
			allowNull: false,
		},
		category: {
			type: DataTypes.ENUM(
				'ADVANCE_PAYMENT',
				'REFUND',
				'PAYMENT_APPLIED',
				'ADJUSTMENT',
				'OTHER',
			),
			allowNull: false,
		},
		paymentMethod: {
			type: DataTypes.ENUM(
				'CASH',
				'BANK_TRANSFER',
				'BANK_TRANSFER_RT',
				'BANK_TRANSFER_RBT',
				'DEBIT_CARD',
				'CREDIT_CARD',
				'NEQUI',
				'BOLD',
				'EFECTY',
				'WOMPI',
				'PAYPHONE',
				'PAYPAL',
				'BANK_DEPOSIT',
				'OTHER',
			),
			allowNull: true,
		},
		currency: {
			type: DataTypes.ENUM('COP', 'USD'),
			allowNull: false,
		},
		amount: {
			type: DataTypes.DECIMAL(15, 2),
			allowNull: false,
		},
		balanceBefore: {
			type: DataTypes.DECIMAL(15, 2),
			allowNull: false,
		},
		balanceAfter: {
			type: DataTypes.DECIMAL(15, 2),
			allowNull: false,
		},
		comments: {
			type: DataTypes.TEXT,
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
		createdDate: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: sequelize.fn('now'),
		},
	},
	{
		sequelize,
		tableName: 'customer_balance_movement',
		schema: 'public',
		timestamps: false,
		createdAt: 'createdDate',
		indexes: [
			{
				name: 'PK_customer_balance_movement_id',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'IDX_customer_balance_movement_customerId',
				fields: [{ name: 'customerId' }],
			},
			{
				name: 'IDX_customer_balance_movement_billingId',
				fields: [{ name: 'billingId' }],
			},
			{
				name: 'IDX_customer_balance_movement_customer_currency',
				fields: [{ name: 'customerId' }, { name: 'currency' }],
			},
		],
	},
);
