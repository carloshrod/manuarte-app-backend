/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.renameTable('part', 'role');
		await queryInterface.renameTable('permit', 'permission');
		await queryInterface.renameTable('part_permits_permit', 'role_permission');

		await queryInterface.renameColumn('role_permission', 'partId', 'roleId');
		await queryInterface.renameColumn(
			'role_permission',
			'permitId',
			'permissionId',
		);

		await queryInterface.renameColumn('user', 'permitPartId', 'roleId');
	},

	async down(queryInterface) {
		await queryInterface.renameColumn('role_permission', 'roleId', 'partId');
		await queryInterface.renameColumn(
			'role_permission',
			'permissionId',
			'permitId',
		);

		await queryInterface.renameTable('role', 'part');
		await queryInterface.renameTable('permission', 'permit');
		await queryInterface.renameTable('role_permission', 'part_permits_permit');

		await queryInterface.renameColumn('user', 'roleId', 'permitPartId');
	},
};
