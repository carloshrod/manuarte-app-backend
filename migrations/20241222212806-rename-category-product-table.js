/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.renameTable('category_product', 'product_category');
		await queryInterface.renameColumn(
			'product',
			'categoryProductId',
			'productCategoryId',
		);
	},

	async down(queryInterface) {
		await queryInterface.renameColumn(
			'product',
			'productCategoryId',
			'categoryProductId',
		);
		await queryInterface.renameTable('product_category', 'category_product');
	},
};
