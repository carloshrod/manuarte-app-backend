/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.renameColumn(
			'transaction_item',
			'totalQuantity',
			'stockBefore',
		);
	},

	async down(queryInterface) {
		await queryInterface.renameColumn(
			'transaction_item',
			'stockBefore',
			'totalQuantity',
		);
	},
};
