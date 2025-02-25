import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { BillingItemModel } from '../billing-item/model';
import { ShopModel } from '../shop/model';
import { CustomerModel } from '../customer/model';
import { Op } from 'sequelize';

export class BillingModel extends Model {
	public id!: string;
	public serialNumber!: string;
	public total!: number;
	public updatedDate!: string;

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
			type: DataTypes.ENUM('PAID', 'PENDING_PAYMENT', 'CANCELED'),
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
			allowNull: false,
		},
		total: {
			type: DataTypes.DOUBLE,
			allowNull: false,
		},
		shipping: {
			type: DataTypes.DOUBLE,
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
		updatedBy: {
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
