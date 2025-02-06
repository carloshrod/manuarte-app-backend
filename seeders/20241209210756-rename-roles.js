/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {

		await queryInterface.bulkUpdate(
			'role',
			{ name: 'admin' },
			{ name: 'Administrador' },
		);

		await queryInterface.bulkUpdate(
			'role',
			{ name: 'cajero' },
			{ name: 'Cajero' },
		);

		await queryInterface.bulkUpdate(
			'role',
			{ name: 'bodeguero' },
			{ name: 'Bodeguero' },
		);
	},

	async down(queryInterface) {
		await queryInterface.bulkUpdate(
			'role',
			{ name: 'Administrador' },
			{ name: 'admin' },
		);

		await queryInterface.bulkUpdate(
			'role',
			{ name: 'Cajero' },
			{ name: 'cajero' },
		);

		await queryInterface.bulkUpdate(
			'role',
			{ name: 'Bodeguero' },
			{ name: 'bodeguero' },
		);
	},
};
