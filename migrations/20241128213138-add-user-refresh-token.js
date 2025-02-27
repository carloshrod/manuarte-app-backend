/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('user', 'refreshToken', {
			type: Sequelize.STRING,
			allowNull: true,
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('user', 'refreshToken');
	},
};
