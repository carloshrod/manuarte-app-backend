/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.changeColumn('quote', 'shipping', {
			type: Sequelize.DOUBLE,
			allowNull: true,
		});

		await queryInterface.changeColumn('billing', 'shipping', {
			type: Sequelize.DOUBLE,
			allowNull: true,
		});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.changeColumn('quote', 'shipping', {
			type: Sequelize.INTEGER,
			allowNull: true,
		});

		await queryInterface.changeColumn('billing', 'shipping', {
			type: Sequelize.INTEGER,
			allowNull: true,
		});
	},
};
