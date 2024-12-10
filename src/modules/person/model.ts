import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { UserModel } from '../user/model';
import { CustomerModel } from '../customer/model';

export class PersonModel extends Model {
	public id!: string;
	public fullName!: string;
	public dni!: string;
}

PersonModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		fullName: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		dni: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: 'UQ_4f83f47c3d77d87ccb066c91af6',
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
		tableName: 'person',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'PK_5fdaf670315c4b7e70cce85daa3',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'UQ_4f83f47c3d77d87ccb066c91af6',
				unique: true,
				fields: [{ name: 'dni' }],
			},
		],
	},
);

// ***** PersonModel-UserModel Relations *****
PersonModel.hasOne(UserModel, {
	foreignKey: 'personId',
	as: 'user',
});

UserModel.belongsTo(PersonModel, {
	foreignKey: 'personId',
	as: 'person',
});

// ***** PersonModel-CustomerModel Relations *****
PersonModel.hasOne(CustomerModel, {
	foreignKey: 'personId',
	as: 'customer',
});

CustomerModel.belongsTo(PersonModel, {
	foreignKey: 'personId',
	as: 'person',
});
