import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { UserModel } from '../user/model';
import { ShopModel } from '../shop/model';
import { CashMovementModel } from '../cash-movement/model';

export class CashSessionModel extends Model {
	public openedAt!: Date;
	public closedAt!: Date | null;
	public openingAmount!: number;
	public closingAmount!: number;
	public declaredClosingAmount!: number;
	public closingDifference!: number;
	public comments!: string | null | undefined;
}

CashSessionModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		shopId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'shop',
				key: 'id',
			},
		},
		openingAmount: {
			type: DataTypes.DECIMAL(15, 2),
			allowNull: false,
			defaultValue: 0,
		},
		declaredOpeningAmount: {
			type: DataTypes.DECIMAL(15, 2),
			allowNull: false,
		},
		openingDifference: {
			type: DataTypes.DECIMAL(15, 2),
			allowNull: false,
			defaultValue: 0,
		},
		openedBy: {
			type: DataTypes.UUID,
			allowNull: false,
			references: { model: 'user', key: 'id' },
		},
		closingAmount: {
			type: DataTypes.DECIMAL(15, 2),
			allowNull: true,
		},
		declaredClosingAmount: {
			type: DataTypes.DECIMAL(15, 2),
			allowNull: true,
		},
		closingDifference: {
			type: DataTypes.DECIMAL(15, 2),
			allowNull: true,
		},
		closedBy: {
			type: DataTypes.UUID,
			allowNull: true,
			references: { model: 'user', key: 'id' },
		},
		comments: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		openedAt: {
			type: DataTypes.DATE,
			allowNull: false,
			defaultValue: sequelize.fn('now'),
		},
		closedAt: {
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
		tableName: 'cash_session',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
		paranoid: true,
	},
);

// ***** CashSessionModel-UserModel Relations *****
CashSessionModel.belongsTo(UserModel, {
	foreignKey: 'openedBy',
	as: 'openedByUser',
});

UserModel.hasMany(CashSessionModel, {
	foreignKey: 'openedBy',
	as: 'openedSessions',
});

CashSessionModel.belongsTo(UserModel, {
	foreignKey: 'closedBy',
	as: 'closedByUser',
});

UserModel.hasMany(CashSessionModel, {
	foreignKey: 'closedBy',
	as: 'closedSessions',
});

// ***** CashSessionModel-ShopModel Relations *****
CashSessionModel.belongsTo(ShopModel, {
	foreignKey: 'shopId',
	as: 'shop',
});

ShopModel.hasMany(CashSessionModel, {
	foreignKey: 'shopId',
	as: 'cashSessions',
});

// ***** CashSessionModel-CashMovementModel Relations *****
CashSessionModel.hasMany(CashMovementModel, {
	foreignKey: 'cashSessionId',
	as: 'movements',
});

CashMovementModel.belongsTo(CashSessionModel, {
	foreignKey: 'cashSessionId',
	as: 'cashSession',
});
