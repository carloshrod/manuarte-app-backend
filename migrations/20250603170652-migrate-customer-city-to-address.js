/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.sequelize.query(`
      UPDATE address
      SET "cityId" = c.id
      FROM customer cust
      JOIN city c ON TRIM(LOWER(cust.city)) = TRIM(LOWER(c.name))
      WHERE address."customerId" = cust.id
        AND address."cityId" IS NULL
        AND cust.city IS NOT NULL;
    `);
	},

	async down(queryInterface) {
		await queryInterface.sequelize.query(`
      UPDATE address
      SET "cityId" = NULL
      WHERE "cityId" IS NOT NULL;
    `);
	},
};
