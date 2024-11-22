import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { BillingItemModel } from '../billing-item/model';
import { ShopModel } from '../shop/model';
import { UserModel } from '../user/model';
import { CustomerModel } from '../customer/model';

export class BillingModel extends Model {}

BillingModel.init(
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
			unique: 'UQ_10dd7ee4fd11025c82da03c3383',
		},
		shopId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'shop',
				key: 'id',
			},
		},
		customerId: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'customer',
				key: 'id',
			},
		},
		createdById: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'user',
				key: 'id',
			},
		},
		status: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		paymentMethod: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		updatedById: {
			type: DataTypes.UUID,
			allowNull: true,
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
		total: {
			type: DataTypes.DOUBLE,
			allowNull: false,
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
		tableName: 'billing',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'PK_d9043caf3033c11ed3d1b29f73c',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'UQ_10dd7ee4fd11025c82da03c3383',
				unique: true,
				fields: [{ name: 'serialNumber' }],
			},
		],
	},
);

// ***** BillingModel-BillingItemModel Relations *****
BillingModel.hasMany(BillingItemModel, {
	foreignKey: 'billId',
	as: 'billingItems',
});

BillingItemModel.belongsTo(BillingModel, {
	foreignKey: 'billId',
	as: 'billing',
});

// ***** BillingModel-ShopModel Relations *****
BillingModel.belongsTo(ShopModel, {
	foreignKey: 'shopId',
	as: 'shop',
});

ShopModel.hasMany(BillingModel, {
	foreignKey: 'shopId',
	as: 'billings',
});

// ***** BillingModel-UserModel Relations *****
BillingModel.belongsTo(UserModel, {
	foreignKey: 'createdById',
	as: 'createdBy',
});

UserModel.hasMany(BillingModel, {
	foreignKey: 'createdById',
	as: 'createdBillings',
});

BillingModel.belongsTo(UserModel, {
	foreignKey: 'updatedById',
	as: 'updatedBy',
});

UserModel.hasMany(BillingModel, {
	foreignKey: 'updatedById',
	as: 'updatedBillings',
});

// ***** BillingModel-CustomerModel Relations *****
BillingModel.belongsTo(CustomerModel, {
	foreignKey: 'customerId',
	as: 'customer',
});

CustomerModel.hasMany(BillingModel, {
	foreignKey: 'customerId',
	as: 'billings',
});
