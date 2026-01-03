import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { AddressModel } from '../address/model';
import { QuoteModel } from '../quote/model';
import { CustomerBalanceModel } from '../customer-balance/model';
import { CustomerBalanceMovementModel } from '../customer-balance/movement-model';

export class CustomerModel extends Model {
	public id!: string;
}

CustomerModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		personId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'person',
				key: 'id',
			},
			unique: 'REL_b48cc61c6aa50b58eb2522ee40',
		},
		email: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		phoneNumber: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		city: {
			type: DataTypes.STRING,
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
		tableName: 'customer',
		schema: 'public',
		timestamps: true,
		paranoid: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
		indexes: [
			{
				name: 'PK_a7a13f4cacb744524e44dfdad32',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'REL_b48cc61c6aa50b58eb2522ee40',
				unique: true,
				fields: [{ name: 'personId' }],
			},
		],
	},
);

// ***** CustomerModel-QuoteModel Relations *****
CustomerModel.hasMany(QuoteModel, {
	foreignKey: 'customerId',
	as: 'quotes',
});

QuoteModel.belongsTo(CustomerModel, {
	foreignKey: 'customerId',
	as: 'customer',
});

// ***** CustomerModel-AddressModel Relations *****
CustomerModel.hasOne(AddressModel, {
	foreignKey: 'customerId',
	as: 'address',
	onDelete: 'CASCADE',
});

AddressModel.belongsTo(CustomerModel, {
	foreignKey: 'customerId',
	as: 'customer',
});

// ***** CustomerModel-CustomerBalanceModel Relations *****
CustomerModel.hasMany(CustomerBalanceModel, {
	foreignKey: 'customerId',
	as: 'balances',
});

CustomerBalanceModel.belongsTo(CustomerModel, {
	foreignKey: 'customerId',
	as: 'customer',
});

// ***** CustomerModel-CustomerBalanceMovementModel Relations *****
CustomerModel.hasMany(CustomerBalanceMovementModel, {
	foreignKey: 'customerId',
	as: 'balanceMovements',
});

CustomerBalanceMovementModel.belongsTo(CustomerModel, {
	foreignKey: 'customerId',
	as: 'customer',
});
