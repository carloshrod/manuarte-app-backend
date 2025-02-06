/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const cajeroRoleId = await queryInterface.rawSelect(
			'role',
			{
				where: { name: 'cajero' },
			},
			['id'],
		);

		await queryInterface.bulkDelete(
			'role_permission',
			{ roleId: cajeroRoleId },
			{},
		);

		const permissionNames = [
			'estimate-read',
			'estimate-create',
			'estimate-update',
			'estimate-delete',
			'billing-read',
			'billing-create',
			'billing-update',
			'billing-delete',
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
				roleId: cajeroRoleId,
				permissionId: permission.id,
			})),
			{},
		);
	},

	async down(queryInterface) {
		const cajeroRoleId = await queryInterface.rawSelect(
			'role',
			{
				where: { name: 'cajero' },
			},
			['id'],
		);

		await queryInterface.bulkDelete(
			'role_permission',
			{ roleId: cajeroRoleId },
			{},
		);
	},
};
