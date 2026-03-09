/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('whatsapp_query_log', {
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
			phoneNumberId: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			rawText: {
				type: Sequelize.TEXT,
				allowNull: false,
			},
			searchTerms: {
				type: Sequelize.ARRAY(Sequelize.TEXT),
				allowNull: false,
				defaultValue: [],
			},
			productFound: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},
			suggestionsShown: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},
			replyText: {
				type: Sequelize.TEXT,
				allowNull: false,
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

		await queryInterface.addIndex('whatsapp_query_log', ['phoneNumber'], {
			name: 'idx_whatsapp_query_log_phone_number',
		});

		await queryInterface.addIndex('whatsapp_query_log', ['createdDate'], {
			name: 'idx_whatsapp_query_log_created_date',
		});
	},

	async down(queryInterface) {
		await queryInterface.dropTable('whatsapp_query_log');
	},
};
