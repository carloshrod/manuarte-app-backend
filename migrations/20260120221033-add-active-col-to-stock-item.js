/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('stock_item', 'active', {
			type: Sequelize.BOOLEAN,
			allowNull: false,
			defaultValue: true,
		});

		await queryInterface.addIndex('stock_item', ['active'], {
			name: 'idx_stock_item_active',
		});
	},

	async down(queryInterface) {
		await queryInterface.removeIndex('stock_item', 'idx_stock_item_active');
		await queryInterface.removeColumn('stock_item', 'active');
	},
};
