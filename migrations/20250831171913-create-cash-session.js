/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('cash_session', {
			id: {
				type: Sequelize.UUID,
				allowNull: false,
				defaultValue: Sequelize.literal('uuid_generate_v4()'),
				primaryKey: true,
			},
			userId: {
				type: Sequelize.UUID,
				allowNull: false,
				references: { model: 'user', key: 'id' },
			},
			shopId: {
				type: Sequelize.UUID,
				allowNull: false,
				references: { model: 'shop', key: 'id' },
			},
			openingAmount: {
				type: Sequelize.DECIMAL(15, 2),
				allowNull: false,
				defaultValue: 0,
			},
			declaredOpeningAmount: {
				type: Sequelize.DECIMAL(15, 2),
				allowNull: false,
			},
			openingDifference: {
				type: Sequelize.DECIMAL(15, 2),
				allowNull: false,
				defaultValue: 0,
			},
			closingAmount: {
				type: Sequelize.DECIMAL(15, 2),
				allowNull: true,
			},
			declaredClosingAmount: {
				type: Sequelize.DECIMAL(15, 2),
				allowNull: true,
			},
			closingDifference: {
				type: Sequelize.DECIMAL(15, 2),
				allowNull: true,
			},
			comments: {
				type: Sequelize.TEXT,
				allowNull: true,
			},
			openedAt: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.fn('now'),
			},
			closedAt: {
				type: Sequelize.DATE,
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
			deletedDate: {
				type: Sequelize.DATE,
				allowNull: true,
			},
		});

		await queryInterface.addIndex('cash_session', ['shopId']);
		await queryInterface.addIndex('cash_session', ['userId']);
	},

	async down(queryInterface) {
		await queryInterface.dropTable({
			tableName: 'cash_session',
			schema: 'public',
		});
	},
};
