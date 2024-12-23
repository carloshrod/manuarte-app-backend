/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.renameTable('variant_product', 'product_variant');
		await queryInterface.renameTable(
			'stock_item_product_variant_product',
			'stock_item_product_variant',
		);

		await queryInterface.renameColumn(
			'quote_item',
			'variantProductId',
			'productVariantId',
		);
		await queryInterface.renameColumn(
			'transaction_item',
			'variantProductId',
			'productVariantId',
		);
		await queryInterface.renameColumn(
			'stock_item_product_variant',
			'variantProductId',
			'productVariantId',
		);
		await queryInterface.renameColumn(
			'billing_item',
			'variantProductId',
			'productVariantId',
		);
	},

	async down(queryInterface) {
		await queryInterface.renameColumn(
			'quote_item',
			'productVariantId',
			'variantProductId',
		);
		await queryInterface.renameColumn(
			'transaction_item',
			'productVariantId',
			'variantProductId',
		);
		await queryInterface.renameColumn(
			'stock_item_product_variant',
			'productVariantId',
			'variantProductId',
		);
		await queryInterface.renameColumn(
			'billing_item',
			'productVariantId',
			'variantProductId',
		);

		await queryInterface.renameTable(
			'stock_item_product_variant',
			'stock_item_product_variant_product',
		);
		await queryInterface.renameTable('product_variant', 'variant_product');
	},
};
