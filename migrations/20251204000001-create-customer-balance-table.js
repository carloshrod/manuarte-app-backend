/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('customer_balance', {
			id: {
				type: Sequelize.UUID,
				defaultValue: Sequelize.literal('uuid_generate_v4()'),
				allowNull: false,
				primaryKey: true,
			},
			customerId: {
				type: Sequelize.UUID,
				allowNull: false,
				references: {
					model: 'customer',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'CASCADE',
			},
			currency: {
				type: Sequelize.ENUM('COP', 'USD'),
				allowNull: false,
			},
			balance: {
				type: Sequelize.DECIMAL(15, 2),
				allowNull: false,
				defaultValue: 0,
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

		// Índice único para customer + currency
		const constraints = await queryInterface.showConstraint('customer_balance');
		const constraintExists = constraints.some(
			c => c.constraintName === 'UQ_customer_balance_customer_currency',
		);

		if (!constraintExists) {
			await queryInterface.addConstraint('customer_balance', {
				fields: ['customerId', 'currency'],
				type: 'unique',
				name: 'UQ_customer_balance_customer_currency',
			});
		}
	},

	async down(queryInterface) {
		await queryInterface.removeConstraint(
			'customer_balances',
			'UQ_customer_balance_customer_currency',
		);
		await queryInterface.dropTable('customer_balance');
	},
};
