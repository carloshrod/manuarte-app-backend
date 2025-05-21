/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('transaction', 'clientRequestId', {
			type: Sequelize.UUID,
			allowNull: true,
			unique: true,
		});

		await queryInterface.sequelize.query(`
      UPDATE transaction
      SET "clientRequestId" = gen_random_uuid()
      WHERE "clientRequestId" IS NULL;
    `);

		await queryInterface.changeColumn('transaction', 'clientRequestId', {
			type: Sequelize.UUID,
			allowNull: false,
			unique: true,
		});

		await queryInterface.addColumn('billing', 'clientRequestId', {
			type: Sequelize.UUID,
			allowNull: true,
			unique: true,
		});

		await queryInterface.sequelize.query(`
      UPDATE billing
      SET "clientRequestId" = gen_random_uuid()
      WHERE "clientRequestId" IS NULL;
    `);

		await queryInterface.changeColumn('billing', 'clientRequestId', {
			type: Sequelize.UUID,
			allowNull: false,
			unique: true,
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('transaction', 'clientRequestId');
		await queryInterface.removeColumn('billing', 'clientRequestId');
	},
};
