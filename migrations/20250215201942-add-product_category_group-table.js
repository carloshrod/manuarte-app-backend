/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('product_category_group', {
			id: {
				type: Sequelize.UUID,
				primaryKey: true,
				allowNull: false,
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true,
			},
			createdBy: {
				type: Sequelize.UUID,
				allowNull: true,
			},
			updatedBy: {
				type: Sequelize.UUID,
				allowNull: true,
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
			deletedDate: {
				type: Sequelize.DATE,
				allowNull: true,
				defaultValue: Sequelize.literal('NOW()'),
			},
		});

		await queryInterface.addColumn(
			'product_category',
			'productCategoryGroupId',
			{
				type: Sequelize.UUID,
				allowNull: true,
				references: {
					model: 'product_category_group',
					key: 'id',
				},
			},
		);
	},

	async down(queryInterface) {
		await queryInterface.dropTable('product_category_group');
	},
};
