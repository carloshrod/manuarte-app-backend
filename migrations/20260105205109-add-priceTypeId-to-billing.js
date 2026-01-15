/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('billing', 'priceTypeId', {
			type: Sequelize.UUID,
			allowNull: true,
			references: {
				model: 'price_type',
				key: 'id',
			},
			onUpdate: 'CASCADE',
			onDelete: 'RESTRICT',
		});

		await queryInterface.addIndex('billing', ['priceTypeId'], {
			name: 'idx_billing_price_type',
		});
	},

	async down(queryInterface) {
		await queryInterface.removeIndex('billing', 'idx_billing_price_type');
		await queryInterface.removeColumn('billing', 'priceTypeId');
	},
};
