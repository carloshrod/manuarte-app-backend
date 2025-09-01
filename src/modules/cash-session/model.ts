import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { UserModel } from '../user/model';
import { ShopModel } from '../shop/model';
import { CashMovementModel } from '../cash-movement/model';

export class CashSessionModel extends Model {
	public openedAt!: string;
	public closedAt!: string;
	public declaredClosingAmount!: string;
}

CashSessionModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		userId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'user',
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
	foreignKey: 'userId',
	as: 'user',
});

UserModel.hasMany(CashSessionModel, {
	foreignKey: 'userId',
	as: 'cashSessions',
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
