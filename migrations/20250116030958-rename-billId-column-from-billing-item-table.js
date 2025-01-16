/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.renameColumn('billing_item', 'billId', 'billingId');
	},

	async down(queryInterface) {
		await queryInterface.renameColumn('billing_item', 'billingId', 'billId');
	},
};
