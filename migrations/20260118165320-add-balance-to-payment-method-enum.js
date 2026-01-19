/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.sequelize.query(`
      ALTER TYPE "enum_billing_payment_paymentMethod" 
      ADD VALUE IF NOT EXISTS 'BALANCE';
    `);
	},

	async down() {
		/**
		 * Add reverting commands here.
		 *
		 * Example:
		 * await queryInterface.dropTable('users');
		 */
	},
};
