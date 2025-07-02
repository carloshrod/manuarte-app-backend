/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('shop', 'countryId', {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: 'country',
				key: 'id',
			},
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('shop', 'countryId');
	},
};
