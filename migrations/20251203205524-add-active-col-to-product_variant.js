/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('product_variant', 'active', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('product_variant', 'active');
	},
};
