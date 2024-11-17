import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';

export class PartModel extends Model {}

PartModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		name: {
			type: DataTypes.STRING,
			allowNull: false,
			unique: 'UQ_a5362eb271179ceec5304917d0d',
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
		tableName: 'part',
		schema: 'public',
		timestamps: false,
		indexes: [
			{
				name: 'PK_58888debdf048d2dfe459aa59da',
				unique: true,
				fields: [{ name: 'id' }],
			},
			{
				name: 'UQ_a5362eb271179ceec5304917d0d',
				unique: true,
				fields: [{ name: 'name' }],
			},
		],
	},
);
