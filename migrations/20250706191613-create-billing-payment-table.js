/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('billing_payment', {
			id: {
				type: Sequelize.UUID,
				defaultValue: Sequelize.literal('uuid_generate_v4()'),
				allowNull: false,
				primaryKey: true,
			},
			billingId: {
				type: Sequelize.UUID,
				allowNull: false,
				references: {
					model: 'billing',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'CASCADE',
			},
			paymentMethod: {
				type: Sequelize.ENUM(
					'CASH',
					'BANK_TRANSFER',
					'BANK_TRANSFER_RT',
					'BANK_TRANSFER_RBT',
					'DEBIT_CARD',
					'CREDIT_CARD',
					'NEQUI',
					'BOLD',
					'EFECTY',
					'WOMPI',
					'PAYPHONE',
					'PAYPAL',
					'BANK_DEPOSIT',
					'OTHER',
				),
				allowNull: false,
			},
			amount: {
				type: Sequelize.DOUBLE,
				allowNull: false,
				defaultValue: 0,
			},
			paymentReference: {
				type: Sequelize.STRING,
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
	},

	async down(queryInterface) {
		await queryInterface.dropTable('billing_payment');
		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_billing_payment_paymentMethod";',
		);
	},
};
