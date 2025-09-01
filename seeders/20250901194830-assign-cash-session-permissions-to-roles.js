/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		const [roles] = await queryInterface.sequelize.query(`
      SELECT id, name FROM public.role WHERE name IN ('admin', 'cajero')
    `);

		const [permissions] = await queryInterface.sequelize.query(`
      SELECT id, name FROM public.permission WHERE name IN (
        'cash-session-read',
        'cash-session-create',
        'cash-session-close',
        'cash-session-movements-read',
        'cash-session-movements-create',
        'cash-session-movements-annul'
      )
    `);

		const roleMap = Object.fromEntries(roles.map(r => [r.name, r.id]));
		const permissionMap = Object.fromEntries(
			permissions.map(p => [p.name, p.id]),
		);

		const rolePermissionPairs = [];

		for (const permName of Object.keys(permissionMap)) {
			rolePermissionPairs.push({
				roleId: roleMap['admin'],
				permissionId: permissionMap[permName],
			});
		}

		for (const permName of Object.keys(permissionMap)) {
			rolePermissionPairs.push({
				roleId: roleMap['cajero'],
				permissionId: permissionMap[permName],
			});
		}

		await queryInterface.bulkInsert('role_permission', rolePermissionPairs, {});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.bulkDelete(
			'role_permission',
			{
				permissionId: Sequelize.literal(`(
        SELECT id FROM public.permission WHERE name IN (
          'cash-session-read',
          'cash-session-create',
          'cash-session-close',
          'cash-session-movements-read',
          'cash-session-movements-create',
          'cash-session-movements-annul'
        )
      )`),
				roleId: Sequelize.literal(`(
        SELECT id FROM public.role WHERE name IN ('admin', 'cajero')
      )`),
			},
			{},
		);
	},
};
