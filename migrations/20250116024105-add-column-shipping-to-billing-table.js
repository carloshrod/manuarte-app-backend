/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('billing', 'shipping', {
			type: Sequelize.DECIMAL,
			allowNull: true,
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('billing', 'shipping');
	},
};
