/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.bulkInsert(
			'permission',
			[
				{
					name: 'bank-transfer-movements-read',
					createdDate: new Date(),
					updatedDate: new Date(),
				},
				{
					name: 'bank-transfer-movements-create',
					createdDate: new Date(),
					updatedDate: new Date(),
				},
				{
					name: 'bank-transfer-movements-annul',
					createdDate: new Date(),
					updatedDate: new Date(),
				},
			],
			{},
		);

		const [roles] = await queryInterface.sequelize.query(`
      SELECT id, name FROM public.role WHERE name IN ('admin', 'cajero')
    `);

		const [permissions] = await queryInterface.sequelize.query(`
      SELECT id, name FROM public.permission WHERE name IN (
        'bank-transfer-movements-read',
        'bank-transfer-movements-create',
        'bank-transfer-movements-annul'
      )
    `);

		const roleMap = Object.fromEntries(roles.map(r => [r.name, r.id]));
		const permissionMap = Object.fromEntries(
			permissions.map(p => [p.name, p.id]),
		);

		const rolePermissionPairs = [];

		for (const roleName of ['admin', 'cajero']) {
			for (const permName of Object.keys(permissionMap)) {
				rolePermissionPairs.push({
					roleId: roleMap[roleName],
					permissionId: permissionMap[permName],
				});
			}
		}

		await queryInterface.bulkInsert('role_permission', rolePermissionPairs, {});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.bulkDelete(
			'role_permission',
			{
				permissionId: Sequelize.literal(`(
        SELECT id FROM public.permission WHERE name IN (
          'bank-transfer-movements-read',
          'bank-transfer-movements-create',
          'bank-transfer-movements-annul'
        )
      )`),
				roleId: Sequelize.literal(`(
        SELECT id FROM public.role WHERE name IN ('admin', 'cajero')
      )`),
			},
			{},
		);

		await queryInterface.bulkDelete(
			'permission',
			{
				name: [
					'bank-transfer-movements-read',
					'bank-transfer-movements-create',
					'bank-transfer-movements-annul',
				],
			},
			{},
		);
	},
};
