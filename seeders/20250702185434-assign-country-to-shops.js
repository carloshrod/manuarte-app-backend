/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		const [countries] = await queryInterface.sequelize.query(
			`SELECT id, currency FROM public.country`,
		);

		const currencyToCountryMap = {};
		countries.forEach(({ id, currency }) => {
			currencyToCountryMap[currency] = id;
		});

		for (const [currency, countryId] of Object.entries(currencyToCountryMap)) {
			await queryInterface.sequelize.query(
				`UPDATE public.shop SET "countryId" = :countryId WHERE currency = :currency`,
				{
					replacements: { countryId, currency },
				},
			);
		}
	},

	async down(queryInterface) {
		await queryInterface.sequelize.query(
			`UPDATE public.shop SET "countryId" = NULL`,
		);
	},
};
