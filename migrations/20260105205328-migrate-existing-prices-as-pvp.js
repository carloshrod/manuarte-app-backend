/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.sequelize.query(`
			INSERT INTO stock_item_price (id, "stockItemId", "priceTypeId", price, "createdDate", "updatedDate")
			SELECT 
				uuid_generate_v4(),
				si.id,
				pt.id,
				si.price,
				NOW(),
				NOW()
			FROM stock_item si
			CROSS JOIN price_type pt
			WHERE pt.code = 'PVP'
			AND si.price IS NOT NULL
			AND NOT EXISTS (
				SELECT 1 
				FROM stock_item_price sip 
				WHERE sip."stockItemId" = si.id 
				AND sip."priceTypeId" = pt.id
			);
		`);
	},

	async down(queryInterface) {
		await queryInterface.sequelize.query(`
			DELETE FROM stock_item_price 
			WHERE "priceTypeId" IN (
				SELECT id FROM price_type WHERE code = 'PVP'
			);
		`);
	},
};
