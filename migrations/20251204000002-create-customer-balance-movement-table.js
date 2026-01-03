/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('customer_balance_movement', {
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
			quoteId: {
				type: Sequelize.UUID,
				allowNull: true,
				references: {
					model: 'quote',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'SET NULL',
			},
			billingId: {
				type: Sequelize.UUID,
				allowNull: true,
				references: {
					model: 'billing',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'SET NULL',
			},
			type: {
				type: Sequelize.ENUM('CREDIT', 'DEBIT'),
				allowNull: false,
			},
			category: {
				type: Sequelize.ENUM(
					'ADVANCE_PAYMENT',
					'REFUND',
					'PAYMENT_APPLIED',
					'ADJUSTMENT',
					'OTHER',
				),
				allowNull: false,
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
				allowNull: true,
			},
			currency: {
				type: Sequelize.ENUM('COP', 'USD'),
				allowNull: false,
			},
			amount: {
				type: Sequelize.DECIMAL(15, 2),
				allowNull: false,
			},
			balanceBefore: {
				type: Sequelize.DECIMAL(15, 2),
				allowNull: false,
			},
			balanceAfter: {
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
				references: {
					model: 'user',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'RESTRICT',
			},
			createdDate: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.fn('now'),
			},
		});

		// Índices para mejorar rendimiento
		await queryInterface.addIndex('customer_balance_movement', ['customerId']);
		await queryInterface.addIndex('customer_balance_movement', ['quoteId']);
		await queryInterface.addIndex('customer_balance_movement', ['billingId']);
		await queryInterface.addIndex('customer_balance_movement', ['createdDate']);
		await queryInterface.addIndex('customer_balance_movement', [
			'customerId',
			'currency',
		]);
	},

	async down(queryInterface) {
		await queryInterface.dropTable('customer_balance_movement');
		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS enum_customer_balance_movement_type;',
		);
		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS enum_customer_balance_movement_category;',
		);
		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS enum_customer_balance_movement_paymentMethod;',
		);
		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS enum_customer_balance_movement_currency;',
		);
	},
};
