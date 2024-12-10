/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.removeColumn('person', 'gender');
		await queryInterface.removeColumn('person', 'birthDate');
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.addColumn('person', 'gender', {
			type: Sequelize.STRING,
			allowNull: true,
		});

		await queryInterface.addColumn('person', 'birthDate', {
			type: Sequelize.STRING,
			allowNull: false,
			defaultValue: Sequelize.fn('now'),
		});
	},
};
