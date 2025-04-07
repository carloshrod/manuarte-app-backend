/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('stock_item', 'minQty', {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		});

		await queryInterface.addColumn('stock_item', 'maxQty', {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('stock_item', 'minQty');
		await queryInterface.removeColumn('stock_item', 'maxQty');
	},
};
