/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.sequelize.query(`
      UPDATE billing
      SET "effectiveDate" = "createdDate"
      WHERE status = 'PAID' AND "effectiveDate" IS NULL
    `);
	},

	async down(queryInterface) {
		await queryInterface.sequelize.query(`
      UPDATE billing
      SET "effectiveDate" = NULL
      WHERE status = 'PAID'
    `);
	},
};
