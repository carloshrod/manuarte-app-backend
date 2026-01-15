/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.sequelize.query(`
			UPDATE billing 
			SET "priceTypeId" = (
				SELECT id FROM price_type WHERE code = 'PVP' LIMIT 1
			)
			WHERE "priceTypeId" IS NULL;
		`);
	},

	async down(queryInterface) {
		await queryInterface.sequelize.query(`
			UPDATE billing 
			SET "priceTypeId" = NULL;
		`);
	},
};
