/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable(
			'bank_transfer_movement',
			{
				id: {
					type: Sequelize.UUID,
					allowNull: false,
					defaultValue: Sequelize.literal('uuid_generate_v4()'),
					primaryKey: true,
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
				amount: {
					type: Sequelize.DECIMAL(15, 2),
					allowNull: false,
				},
				reference: {
					type: Sequelize.STRING,
					allowNull: true,
				},
				comments: {
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
				deletedDate: {
					type: Sequelize.DATE,
					allowNull: true,
				},
			},
			{
				schema: 'public',
			},
		);

		await queryInterface.addIndex('bank_transfer_movement', [
			'billingPaymentId',
		]);
		await queryInterface.addIndex('bank_transfer_movement', ['type']);
	},

	async down(queryInterface) {
		await queryInterface.dropTable({
			tableName: 'bank_transfer_movement',
			schema: 'public',
		});
	},
};
