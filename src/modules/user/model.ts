import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { RoleModel } from '../role/model';
import bcrypt from 'bcrypt';

export class UserModel extends Model {
	public id!: string;
	public email!: string;
	public roleId!: string;
	public personId!: string;
	public password!: string;
	public refreshToken!: string;
}

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
		roleId: {
			type: DataTypes.UUID,
			allowNull: true,
			references: {
				model: 'role',
				key: 'id',
			},
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
		refreshToken: {
			type: DataTypes.STRING,
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
		hooks: {
			beforeCreate: async user => {
				if (user.password !== null) {
					user.password = await bcrypt.hash(user.password, 10);
				}
			},
			beforeUpdate: async user => {
				if (user.changed('password')) {
					user.password = await bcrypt.hash(user.password, 10);
				}
				if (user.refreshToken !== null && user.changed('refreshToken')) {
					user.refreshToken = await bcrypt.hash(user.refreshToken, 10);
				}
			},
		},
	},
);

UserModel.belongsTo(RoleModel, {
	foreignKey: 'roleId',
	as: 'role',
});

RoleModel.hasMany(UserModel, {
	foreignKey: 'roleId',
	as: 'users',
});
