/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.renameTable('estimate', 'quote');
		await queryInterface.renameColumn('quote', 'createdById', 'createdBy');
		await queryInterface.renameColumn('quote', 'updatedById', 'updatedBy');

		await queryInterface.renameTable('estimate_item', 'quote_item');
		await queryInterface.renameColumn('quote_item', 'estimateId', 'quoteId');
	},

	async down(queryInterface) {
		await queryInterface.renameColumn('quote_item', 'quoteId', 'estimateId');
		await queryInterface.renameTable('quote_item', 'estimate_item');

		await queryInterface.renameColumn('quote', 'createdBy', 'createdById');
		await queryInterface.renameColumn('quote', 'updatedBy', 'updatedById');
		await queryInterface.renameTable('quote', 'estimate');
	},
};
