/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable(
			'cash_movement',
			{
				id: {
					type: Sequelize.UUID,
					allowNull: false,
					defaultValue: Sequelize.literal('uuid_generate_v4()'),
					primaryKey: true,
				},
				cashSessionId: {
					type: Sequelize.UUID,
					allowNull: false,
					references: {
						model: 'cash_session',
						key: 'id',
					},
					onUpdate: 'CASCADE',
					onDelete: 'RESTRICT',
				},
				billingPaymentId: {
					type: Sequelize.UUID,
					allowNull: true,
					references: {
						model: 'billing_payment',
						key: 'id',
					},
					onUpdate: 'CASCADE',
					onDelete: 'SET NULL',
				},
				type: {
					type: Sequelize.ENUM('INCOME', 'EXPENSE'),
					allowNull: false,
				},
				category: {
					type: Sequelize.ENUM(
						'SALE',
						'DELIVERY',
						'INBOUND_SHIPPING',
						'PURCHASE',
						'CHANGE',
						'PIGGY_BANK',
						'OTHER',
					),
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
					allowNull: true,
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
			},
			{
				schema: 'public',
			},
		);

		await queryInterface.addIndex('cash_movement', ['cashSessionId']);
		await queryInterface.addIndex('cash_movement', ['billingPaymentId']);
		await queryInterface.addIndex('cash_movement', ['type']);
		await queryInterface.addIndex('cash_movement', ['category']);
		await queryInterface.addIndex('cash_movement', ['createdBy']);
	},

	async down(queryInterface) {
		await queryInterface.dropTable({
			tableName: 'cash_movement',
			schema: 'public',
		});
	},
};
