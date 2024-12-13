import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { AddressModel } from '../address/model';

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
		city: {
			type: DataTypes.STRING,
			allowNull: true,
		},
	},
	{
		sequelize,
		tableName: 'customer',
		schema: 'public',
		timestamps: false,
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

CustomerModel.hasMany(AddressModel, {
	foreignKey: 'customerId',
	as: 'addresses',
	onDelete: 'CASCADE',
});

AddressModel.belongsTo(CustomerModel, {
	foreignKey: 'customerId',
	as: 'customer',
});
