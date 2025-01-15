/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.bulkInsert(
			'permission',
			[
				{
					name: 'customer-search',
					createdDate: new Date(),
					updatedDate: new Date(),
				},
				{
					name: 'product-search',
					createdDate: new Date(),
					updatedDate: new Date(),
				},
			],
			{},
		);
	},

	async down(queryInterface) {
		await queryInterface.bulkDelete(
			'permission',
			{ name: ['customer-search', 'product-search'] },
			{},
		);
	},
};
