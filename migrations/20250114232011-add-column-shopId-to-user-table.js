/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('user', 'shopId', {
			type: Sequelize.UUID,
			allowNull: true,
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('user', 'shopId');
	},
};
