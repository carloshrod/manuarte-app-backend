import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { PartModel } from '../part/model';

export class UserModel extends Model {}

UserModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		email: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: 'UQ_e12875dfb3b1d92d7d7c5377e22',
		},
		password: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		permitPartId: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'part',
				key: 'id',
			},
		},
		salt: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		isActive: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		personId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'person',
				key: 'id',
			},
			unique: 'REL_6aac19005cea8e2119cbe7759e',
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
		tableName: 'user',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'PK_cace4a159ff9f2512dd42373760',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'REL_6aac19005cea8e2119cbe7759e',
				unique: true,
				fields: [{ name: 'personId' }],
			},
			{
				name: 'UQ_e12875dfb3b1d92d7d7c5377e22',
				unique: true,
				fields: [{ name: 'email' }],
			},
		],
	},
);

UserModel.belongsTo(PartModel, {
	foreignKey: 'permitPartId',
	as: 'permitPart',
});

PartModel.hasMany(UserModel, {
	foreignKey: 'permitPartId',
	as: 'users',
});