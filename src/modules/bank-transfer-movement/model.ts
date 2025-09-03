import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { BillingPaymentModel } from '../billing-payment/model';
import { UserModel } from '../user/model';

export class BankTransferMovementModel extends Model {}

BankTransferMovementModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
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
		amount: {
			type: DataTypes.DECIMAL(15, 2),
			allowNull: false,
		},
		reference: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		comments: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		createdBy: {
			type: DataTypes.UUID,
			allowNull: true,
			references: { model: 'user', key: 'id' },
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
		tableName: 'bank_transfer_movement',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
		paranoid: true,
	},
);

// ***** BankTransferMovementModel-BillingPaymentModel Relations *****
BankTransferMovementModel.belongsTo(BillingPaymentModel, {
	foreignKey: 'billingPaymentId',
	as: 'billingPayment',
});

BillingPaymentModel.hasOne(BankTransferMovementModel, {
	foreignKey: 'billingPaymentId',
	as: 'bankTransferMovement',
});

// ***** BankTransferMovementModel-UserModel Relations *****
BankTransferMovementModel.belongsTo(UserModel, {
	foreignKey: 'createdBy',
	as: 'creator',
});

UserModel.hasMany(BankTransferMovementModel, {
	foreignKey: 'createdBy',
	as: 'manualTransferMovements',
});
