/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('bank_transfer_movement', 'paymentMethod', {
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
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn(
			'bank_transfer_movement',
			'paymentMethod',
		);
	},
};
