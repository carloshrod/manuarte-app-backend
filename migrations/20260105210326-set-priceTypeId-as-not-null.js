/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const [nullRecords] = await queryInterface.sequelize.query(`
			SELECT COUNT(*) as count 
			FROM billing 
			WHERE "priceTypeId" IS NULL;
		`);

		if (parseInt(nullRecords[0].count) > 0) {
			throw new Error(
				`Hay ${nullRecords[0].count} registros en billing con priceTypeId NULL.`,
			);
		}

		await queryInterface.changeColumn('billing', 'priceTypeId', {
			type: Sequelize.UUID,
			allowNull: false,
		});
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.changeColumn('billing', 'priceTypeId', {
			type: Sequelize.UUID,
			allowNull: true,
		});
	},
};
