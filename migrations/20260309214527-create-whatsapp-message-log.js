/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('whatsapp_message_log', {
			id: {
				type: Sequelize.UUID,
				allowNull: false,
				defaultValue: Sequelize.literal('uuid_generate_v4()'),
				primaryKey: true,
			},
			phoneNumber: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			botPhoneNumberId: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			direction: {
				type: Sequelize.ENUM('inbound', 'outbound'),
				allowNull: false,
			},
			text: {
				type: Sequelize.TEXT,
				allowNull: false,
			},
			intent: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			countryPrefix: {
				type: Sequelize.STRING(10),
				allowNull: true,
			},
			createdDate: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('now()'),
			},
			updatedDate: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('now()'),
			},
		});

		await queryInterface.addIndex('whatsapp_message_log', ['phoneNumber'], {
			name: 'idx_whatsapp_message_log_phone_number',
		});

		await queryInterface.addIndex('whatsapp_message_log', ['createdDate'], {
			name: 'idx_whatsapp_message_log_created_date',
		});

		await queryInterface.addIndex('whatsapp_message_log', ['direction'], {
			name: 'idx_whatsapp_message_log_direction',
		});
	},

	async down(queryInterface) {
		await queryInterface.dropTable('whatsapp_message_log');
		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_whatsapp_message_log_direction";',
		);
	},
};
