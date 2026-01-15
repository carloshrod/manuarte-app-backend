/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('stock_item_price', {
			id: {
				type: Sequelize.UUID,
				primaryKey: true,
				allowNull: false,
				defaultValue: Sequelize.literal('uuid_generate_v4()'),
			},
			stockItemId: {
				type: Sequelize.UUID,
				allowNull: false,
				references: {
					model: 'stock_item',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'CASCADE',
			},
			priceTypeId: {
				type: Sequelize.UUID,
				allowNull: false,
				references: {
					model: 'price_type',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'RESTRICT',
			},
			price: {
				type: Sequelize.DECIMAL(15, 2),
				allowNull: false,
			},
			createdDate: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('NOW()'),
			},
			updatedDate: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('NOW()'),
			},
		});

		await queryInterface.addConstraint('stock_item_price', {
			fields: ['stockItemId', 'priceTypeId'],
			type: 'unique',
			name: 'uq_stock_item_price_type',
		});

		await queryInterface.addIndex('stock_item_price', ['stockItemId'], {
			name: 'idx_stock_item_price_stock_item',
		});

		await queryInterface.addIndex('stock_item_price', ['priceTypeId'], {
			name: 'idx_stock_item_price_type',
		});
	},

	async down(queryInterface) {
		await queryInterface.dropTable('stock_item_price');
	},
};
