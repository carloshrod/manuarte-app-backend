/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */
'use strict';

const citiesData = require('../data/ecuCities.json');

function capitalizeWords(str) {
	return str
		.toLowerCase()
		.split(' ')
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		const regions = await queryInterface.sequelize.query(
			'SELECT id, name FROM region WHERE "countryId" = 2 ORDER BY id',
			{ type: queryInterface.sequelize.QueryTypes.SELECT },
		);

		const provinceToRegionId = {};
		regions.forEach(region => {
			provinceToRegionId[region.name] = region.id;
		});

		const citiesDataToInsert = [];

		citiesData.forEach(item => {
			const regionNameCap = capitalizeWords(item.name);
			const regionId = provinceToRegionId[regionNameCap];

			if (!regionId) {
				console.warn(`No se encontró región para: ${regionNameCap}.`);
				return;
			}

			item.cities.forEach(city => {
				const cityNameCap = capitalizeWords(city.name);

				citiesDataToInsert.push({
					name: cityNameCap,
					regionId,
					createdDate: new Date(),
					updatedDate: new Date(),
				});
			});
		});

		const batchSize = 100;
		for (let i = 0; i < citiesDataToInsert.length; i += batchSize) {
			const batch = citiesDataToInsert.slice(i, i + batchSize);
			await queryInterface.bulkInsert('city', batch);
		}
	},

	async down(queryInterface) {
		await queryInterface.bulkDelete('city', null, {});
	},
};
