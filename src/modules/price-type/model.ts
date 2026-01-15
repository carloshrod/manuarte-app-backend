import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';

export class PriceTypeModel extends Model {
	public id!: string;
	public code!: string;
	public name!: string;
	public description?: string;
	public isDefault!: boolean;
	public isActive!: boolean;
	public createdDate!: Date;
}

PriceTypeModel.init(
	{
		id: {
			type: DataTypes.UUID,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		code: {
			type: DataTypes.STRING(10),
			allowNull: false,
			unique: true,
		},
		name: {
			type: DataTypes.STRING(50),
			allowNull: false,
		},
		description: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		isDefault: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},
		isActive: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},
		createdDate: {
			type: DataTypes.DATE,
			defaultValue: sequelize.fn('now'),
		},
	},
	{
		sequelize,
		tableName: 'price_type',
		schema: 'public',
		timestamps: false,
	},
);
