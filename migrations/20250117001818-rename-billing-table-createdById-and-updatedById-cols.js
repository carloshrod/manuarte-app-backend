/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.renameColumn('billing', 'createdById', 'createdBy');
		await queryInterface.renameColumn('billing', 'updatedById', 'updatedBy');
	},

	async down(queryInterface) {
		await queryInterface.renameColumn('billing', 'createdBy', 'createdById');
		await queryInterface.renameColumn('billing', 'updatedBy', 'updatedById');
	},
};
