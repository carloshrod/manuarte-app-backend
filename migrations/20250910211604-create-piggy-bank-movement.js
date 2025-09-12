/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('piggy_bank_movement', {
			id: {
				type: Sequelize.UUID,
				allowNull: false,
				defaultValue: Sequelize.literal('gen_random_uuid()'),
				primaryKey: true,
			},
			cashSessionId: {
				type: Sequelize.UUID,
				allowNull: false,
				references: { model: 'cash_session', key: 'id' },
				onDelete: 'CASCADE',
			},
			type: {
				type: Sequelize.ENUM('DEPOSIT', 'WITHDRAW'),
				allowNull: false,
			},
			amount: {
				type: Sequelize.DECIMAL(15, 2),
				allowNull: false,
			},
			comments: {
				type: Sequelize.TEXT,
				allowNull: true,
			},
			createdBy: {
				type: Sequelize.UUID,
				allowNull: false,
				references: { model: 'user', key: 'id' },
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
			deletedDate: {
				type: Sequelize.DATE,
				allowNull: true,
			},
		});

		await queryInterface.addIndex('piggy_bank_movement', ['cashSessionId']);
		await queryInterface.addIndex('piggy_bank_movement', ['type']);
		await queryInterface.addIndex('piggy_bank_movement', ['createdBy']);
	},

	async down(queryInterface) {
		await queryInterface.dropTable('piggy_bank_movement');
	},
};
