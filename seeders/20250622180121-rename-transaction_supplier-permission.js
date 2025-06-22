/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.bulkUpdate(
			'permission',
			{ name: 'transaction-direct-enter' },
			{ name: 'transaction-supplier' },
		);
	},

	async down(queryInterface) {
		await queryInterface.bulkUpdate(
			'permission',
			{ name: 'transaction-supplier' },
			{ name: 'transaction-direct-enter' },
		);
	},
};
