import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { BillingItemModel } from '../billing-item/model';
import { ShopModel } from '../shop/model';
import { CustomerModel } from '../customer/model';
import { Op } from 'sequelize';
import { BillingPaymentModel } from '../billing-payment/model';

export class BillingModel extends Model {
	public id!: string;
	public serialNumber!: string;
	public subtotal!: number;
	public createdDate!: string;

	async generateSerialNumber() {
		try {
			const lastBill = await BillingModel.findOne({
				where: { id: { [Op.not]: null } },
				order: [['serialNumber', 'DESC']],
				paranoid: false,
			});

			if (lastBill) {
				const numberArr = lastBill.serialNumber.split('-');
				const lastNumber = parseInt(numberArr[2], 10);
				const newNumber = lastNumber + 1;

				this.serialNumber = `001-001-${newNumber.toString().padStart(9, '0')}`;
			} else {
				this.serialNumber = '001-001-000000001';
			}
		} catch (error) {
			console.error('Error generando número serial de factura');
			throw error;
		}
	}
}

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
		status: {
			type: DataTypes.ENUM(
				'PAID',
				'PENDING_PAYMENT',
				'PARTIAL_PAYMENT',
				'PENDING_DELIVERY',
				'CANCELED',
			),
			allowNull: false,
		},
		comments: {
			type: DataTypes.TEXT,
			allowNull: true,
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
			allowNull: false,
		},
		subtotal: {
			type: DataTypes.DOUBLE,
			allowNull: false,
		},
		discountType: {
			type: DataTypes.ENUM('PERCENTAGE', 'FIXED'),
			allowNull: true,
			defaultValue: null,
		},
		discount: {
			type: DataTypes.DOUBLE,
			allowNull: true,
			defaultValue: 0,
		},
		shipping: {
			type: DataTypes.DOUBLE,
			allowNull: true,
			defaultValue: 0,
		},
		clientRequestId: {
			type: DataTypes.UUID,
			allowNull: false,
			unique: true,
		},
		createdBy: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'user',
				key: 'id',
			},
		},
		updatedBy: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'user',
				key: 'id',
			},
		},
		effectiveDate: {
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
		tableName: 'billing',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
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
	foreignKey: 'billingId',
	as: 'billingItems',
});

BillingItemModel.belongsTo(BillingModel, {
	foreignKey: 'billingId',
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

// ***** BillingModel-CustomerModel Relations *****
BillingModel.belongsTo(CustomerModel, {
	foreignKey: 'customerId',
	as: 'customer',
});

CustomerModel.hasMany(BillingModel, {
	foreignKey: 'customerId',
	as: 'billings',
});

// ***** BillingModel-BillingPaymentModel Relations *****
BillingModel.hasMany(BillingPaymentModel, {
	foreignKey: 'billingId',
	as: 'payments',
});

BillingPaymentModel.belongsTo(BillingModel, {
	foreignKey: 'billingId',
	as: 'billing',
});
