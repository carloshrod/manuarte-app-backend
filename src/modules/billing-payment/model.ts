import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';

export class BillingPaymentModel extends Model {
	public id!: string;
}

BillingPaymentModel.init(
	{
		id: {
			type: DataTypes.UUID,
			primaryKey: true,
			defaultValue: DataTypes.UUIDV4,
		},
		billingId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'billing',
				key: 'id',
			},
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
				'BALANCE',
				'OTHER',
			),
			allowNull: false,
		},
		amount: {
			type: DataTypes.DOUBLE,
			allowNull: false,
		},
		paymentReference: {
			type: DataTypes.STRING,
			allowNull: true,
		},
	},
	{
		sequelize,
		tableName: 'billing_payment',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
	},
);
