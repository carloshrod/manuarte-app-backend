/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.bulkInsert(
			'permission',
			[
				{
					name: 'cash-session-read',
					createdDate: new Date(),
					updatedDate: new Date(),
				},
				{
					name: 'cash-session-create',
					createdDate: new Date(),
					updatedDate: new Date(),
				},
				{
					name: 'cash-session-close',
					createdDate: new Date(),
					updatedDate: new Date(),
				},
				{
					name: 'cash-session-movements-read',
					createdDate: new Date(),
					updatedDate: new Date(),
				},
				{
					name: 'cash-session-movements-create',
					createdDate: new Date(),
					updatedDate: new Date(),
				},
				{
					name: 'cash-session-movements-annul',
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
			{
				name: [
					'cash-session-read',
					'cash-session-create',
					'cash-session-close',
					'cash-session-movements-read',
					'cash-session-movements-create',
					'cash-session-movements-annul',
				],
			},
			{},
		);
	},
};
