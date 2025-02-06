/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('stock', 'isMain', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		});

		await queryInterface.bulkUpdate(
			'stock',
			{ isMain: true },
			{ name: 'Fabrica Cascajal' },
		);
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('stock', 'isMain');
	},
};
