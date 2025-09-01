import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { BillingPaymentModel } from '../billing-payment/model';

export class CashMovementModel extends Model {}

CashMovementModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		cashSessionId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'cash_session',
				key: 'id',
			},
		},
		billingPaymentId: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'billing_payment',
				key: 'id',
			},
		},
		type: {
			type: DataTypes.ENUM('INCOME', 'EXPENSE'),
			allowNull: false,
		},
		category: {
			type: DataTypes.ENUM(
				'SALE',
				'DELIVERY',
				'INBOUND_SHIPPING',
				'PURCHASE',
				'CHANGE',
				'PIGGY_BANK',
				'OTHER',
			),
			allowNull: false,
		},
		amount: {
			type: DataTypes.DECIMAL(15, 2),
			allowNull: false,
		},
		comments: {
			type: DataTypes.TEXT,
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
		tableName: 'cash_movement',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
		paranoid: true,
	},
);

// ***** CashMovementModel-BillingPaymentModel Relations *****
CashMovementModel.belongsTo(BillingPaymentModel, {
	foreignKey: 'billingPaymentId',
	as: 'billingPayment',
});

BillingPaymentModel.hasOne(CashMovementModel, {
	foreignKey: 'billingPaymentId',
	as: 'cashMovement',
});
