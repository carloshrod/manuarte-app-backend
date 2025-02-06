/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.bulkDelete('permission', null, {});
		
		const items = [
			'product',
			'user',
			'customer',
			'billing',
			'estimate',
			'permission',
			'stock',
			'transaction',
			'dashboard',
		];

		await queryInterface.bulkInsert(
			'permission',
			items
				.map(table => {
					return [
						{
							name: `${table}-read`,
							createdDate: new Date(),
							updatedDate: new Date(),
						},
						{
							name: `${table}-create`,
							createdDate: new Date(),
							updatedDate: new Date(),
						},
						{
							name: `${table}-update`,
							createdDate: new Date(),
							updatedDate: new Date(),
						},
						{
							name: `${table}-delete`,
							createdDate: new Date(),
							updatedDate: new Date(),
						},
					];
				})
				.flat(),
			{},
		);
	},

	async down(queryInterface) {
		await queryInterface.bulkDelete('permission', null, {});
	},
};
