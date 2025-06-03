/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */
'use strict';

const citiesData = require('../data/colCities.json');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		const regions = await queryInterface.sequelize.query(
			'SELECT id, name FROM region WHERE "countryId" = 1 ORDER BY id',
			{ type: queryInterface.sequelize.QueryTypes.SELECT },
		);

		const departmentToRegionId = {};
		regions.forEach(region => {
			departmentToRegionId[region.name] = region.id;
		});

		const citiesDataToInsert = citiesData.flatMap(item => {
			const regionId = departmentToRegionId[item.departamento];
			if (!regionId) {
				throw new Error(
					`No se encontró el ID de región para ${item.departamento}`,
				);
			}

			return item.ciudades?.map(cityName => ({
				name: cityName,
				regionId,
				createdDate: new Date(),
				updatedDate: new Date(),
			}));
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
