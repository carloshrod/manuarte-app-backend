/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.sequelize.query(`
      UPDATE bank_transfer_movement btm
      SET "paymentMethod" = bp."paymentMethod"::text::"enum_bank_transfer_movement_paymentMethod"
      FROM billing_payment bp
      WHERE btm."billingPaymentId" = bp.id
        AND btm."paymentMethod" IS NULL;
    `);
	},

	async down(queryInterface) {
		await queryInterface.sequelize.query(`
      UPDATE bank_transfer_movement
      SET "paymentMethod" = NULL;
    `);
	},
};
