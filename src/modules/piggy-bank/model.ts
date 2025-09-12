import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { UserModel } from '../user/model';
import { CashSessionModel } from '../cash-session/model';

export class PiggyBankMovementModel extends Model {
	public type!: 'DEPOSIT' | 'WITHDRAW';
	public amount!: number;
}

PiggyBankMovementModel.init(
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
		type: {
			type: DataTypes.ENUM('DEPOSIT', 'WITHDRAW'),
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
		createdBy: {
			type: DataTypes.UUID,
			allowNull: false,
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
		tableName: 'piggy_bank_movement',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
		paranoid: true,
	},
);

// ***** PiggyBankMovementModel-CashSessionModel Relations *****
PiggyBankMovementModel.belongsTo(CashSessionModel, {
	foreignKey: 'cashSessionId',
	as: 'cashSession',
});

CashSessionModel.hasMany(PiggyBankMovementModel, {
	foreignKey: 'cashSessionId',
	as: 'piggyBankMovements',
});

// ***** PiggyBankMovementModel-UserModel Relations *****
PiggyBankMovementModel.belongsTo(UserModel, {
	foreignKey: 'createdBy',
	as: 'creator',
});

UserModel.hasMany(PiggyBankMovementModel, {
	foreignKey: 'createdBy',
	as: 'piggyBankMovements',
});
