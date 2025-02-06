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

		await queryInterface.bulkDelete(
			'role_permission',
			{ roleId: adminRoleId },
			{},
		);

		const permissions = await queryInterface.sequelize.query(
			'SELECT id FROM permission',
			{
				type: Sequelize.QueryTypes.SELECT,
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

		await queryInterface.bulkDelete(
			'role_permission',
			{ roleId: adminRoleId },
			{},
		);
	},
};
