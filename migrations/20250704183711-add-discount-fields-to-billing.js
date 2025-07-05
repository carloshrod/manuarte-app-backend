/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('billing', 'discountType', {
			type: Sequelize.ENUM('PERCENTAGE', 'FIXED'),
			allowNull: true,
			defaultValue: null,
		});

		await queryInterface.addColumn('billing', 'discount', {
			type: Sequelize.DOUBLE,
			allowNull: true,
			defaultValue: 0,
		});

		await queryInterface.renameColumn('billing', 'total', 'subtotal');
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('billing', 'discountType');
		await queryInterface.removeColumn('billing', 'discount');
		await queryInterface.renameColumn('billing', 'subtotal', 'total');

		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_billing_discountType";',
		);
	},
};
