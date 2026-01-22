import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';
import { StockItemModel } from '../stock-item/model';

export class StockModel extends Model {
	public name!: string;
}

StockModel.init(
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
		},
		shopId: {
			type: DataTypes.UUID,
			allowNull: false,
			references: {
				model: 'shop',
				key: 'id',
			},
		},
		isDefault: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		isMain: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
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
		tableName: 'stock',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
		deletedAt: 'deletedDate',
		indexes: [
			{
				name: 'PK_092bc1fc7d860426a1dec5aa8e9',
				unique: true,
				fields: [{ name: 'id' }],
			},
		],
	},
);

StockModel.hasMany(StockItemModel, {
	foreignKey: 'stockId',
	as: 'stockItems',
});

StockItemModel.belongsTo(StockModel, {
	foreignKey: 'stockId',
	as: 'stock',
});
