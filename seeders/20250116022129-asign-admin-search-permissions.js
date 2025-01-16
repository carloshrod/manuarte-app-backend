/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const adminRoleId = await queryInterface.rawSelect(
			'role',
			{
				where: { name: 'admin' },
			},
			['id'],
		);

		const permissionNames = ['customer-search', 'product-search'];

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
				roleId: adminRoleId,
				permissionId: permission.id,
			})),
			{},
		);
	},

	async down(queryInterface) {
		const adminRoleId = await queryInterface.rawSelect(
			'role',
			{
				where: { name: 'admin' },
			},
			['id'],
		);

		const customerSearchId = await queryInterface.rawSelect(
			'permission',
			{
				where: { name: 'customer-search' },
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
				permissionId: [customerSearchId, productSearchId],
			},
			{},
		);
	},
};
