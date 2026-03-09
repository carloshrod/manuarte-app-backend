import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../../config/database';

export class WhatsAppMessageLogModel extends Model {
	public id!: string;
	public phoneNumber!: string;
	public phoneNumberId!: string;
	public direction!: 'inbound' | 'outbound';
	public text!: string;
	public intent!: string | null;
	public countryPrefix!: string | null;
}

WhatsAppMessageLogModel.init(
	{
		id: {
			type: DataTypes.UUID,
			allowNull: false,
			defaultValue: DataTypes.UUIDV4,
			primaryKey: true,
		},
		phoneNumber: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		phoneNumberId: {
			type: DataTypes.STRING,
			allowNull: false,
		},
		direction: {
			type: DataTypes.ENUM('inbound', 'outbound'),
			allowNull: false,
		},
		text: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		intent: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		countryPrefix: {
			type: DataTypes.STRING(10),
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
	},
	{
		sequelize,
		tableName: 'whatsapp_message_log',
		schema: 'public',
		timestamps: true,
		createdAt: 'createdDate',
		updatedAt: 'updatedDate',
	},
);
