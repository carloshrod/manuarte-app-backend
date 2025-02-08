/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.renameTable('provider', 'supplier');
		await queryInterface.renameColumn(
			'transaction',
			'providerId',
			'supplierId',
		);
	},

	async down(queryInterface) {
		await queryInterface.renameColumn(
			'transaction',
			'supplierId',
			'providerId',
		);
		await queryInterface.renameTable('supplier', 'provider');
	},
};
