/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const bodegueroRoleId = await queryInterface.rawSelect(
			'role',
			{
				where: { name: 'bodeguero' },
			},
			['id'],
		);

		const permissionNames = [
			'product-read',
			'product-create',
			'product-update',
			'product-delete',
			'stock-read',
			'stock-create',
			'stock-update',
			'stock-delete',
			'transaction-read',
			'transaction-create',
			'transaction-update',
			'transaction-delete',
		];

		const permissions = await queryInterface.sequelize.query(
			`SELECT id FROM permission WHERE name IN (:permissionNames)`,
			{
				type: Sequelize.QueryTypes.SELECT,
				replacements: { permissionNames },
			},
		);

		await queryInterface.bulkInsert(
			'role_permission',
			permissions.map(permission => ({
				roleId: bodegueroRoleId,
				permissionId: permission.id,
			})),
			{},
		);
	},

	async down(queryInterface) {
		const bodegueroRoleId = await queryInterface.rawSelect(
			'role',
			{
				where: { name: 'bodeguero' },
			},
			['id'],
		);

		await queryInterface.bulkDelete(
			'role_permission',
			{ roleId: bodegueroRoleId },
			{},
		);
	},
};
