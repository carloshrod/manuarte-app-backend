/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('quote', 'discountType', {
			type: Sequelize.ENUM('PERCENTAGE', 'FIXED'),
			allowNull: true,
			defaultValue: null,
		});

		await queryInterface.addColumn('quote', 'discount', {
			type: Sequelize.DOUBLE,
			allowNull: true,
			defaultValue: 0,
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('quote', 'discountType');
		await queryInterface.removeColumn('quote', 'discount');

		await queryInterface.sequelize.query(
			'DROP TYPE IF EXISTS "enum_quote_discountType";',
		);
	},
};
