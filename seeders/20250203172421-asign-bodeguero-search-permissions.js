/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const adminRoleId = await queryInterface.rawSelect(
			'role',
			{
				where: { name: 'bodeguero' },
			},
			['id'],
		);

		const permissions = await queryInterface.sequelize.query(
			`SELECT id FROM permission WHERE name = :permissionName`,
			{
				type: Sequelize.QueryTypes.SELECT,
				replacements: { permissionName: 'product-search' },
			},
		);

		await queryInterface.bulkInsert('role_permission', [
			{
				roleId: adminRoleId,
				permissionId: permissions[0].id,
			},
		]);
	},

	async down(queryInterface) {
		const adminRoleId = await queryInterface.rawSelect(
			'role',
			{
				where: { name: 'bodeguero' },
			},
			['id'],
		);

		const productSearchId = await queryInterface.rawSelect(
			'permission',
			{
				where: { name: 'product-search' },
			},
			['id'],
		);

		await queryInterface.bulkDelete(
			'role_permission',
			{
				roleId: adminRoleId,
				permissionId: productSearchId,
			},
			{},
		);
	},
};
