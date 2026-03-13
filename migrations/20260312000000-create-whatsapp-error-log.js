/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('whatsapp_error_log', {
			id: {
				type: Sequelize.UUID,
				allowNull: false,
				defaultValue: Sequelize.literal('uuid_generate_v4()'),
				primaryKey: true,
			},
			context: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			errorMessage: {
				type: Sequelize.TEXT,
				allowNull: false,
			},
			errorStack: {
				type: Sequelize.TEXT,
				allowNull: true,
			},
			phoneNumber: {
				type: Sequelize.STRING,
				allowNull: true,
			},
			rawText: {
				type: Sequelize.TEXT,
				allowNull: true,
			},
			createdDate: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.fn('now'),
			},
			updatedDate: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.fn('now'),
			},
		});

		await queryInterface.addIndex('whatsapp_error_log', ['context']);
		await queryInterface.addIndex('whatsapp_error_log', ['phoneNumber']);
	},

	async down(queryInterface) {
		await queryInterface.dropTable({
			tableName: 'whatsapp_error_log',
			schema: 'public',
		});
	},
};
