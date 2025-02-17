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
			'quote-read',
			'quote-create',
			'quote-update',
			'quote-delete',
			'billing-read',
			'billing-create',
			'billing-update',
			'billing-delete',
			'stock-item-read',
			'stock-item-create',
			'stock-item-update',
			'stock-item-delete',
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
