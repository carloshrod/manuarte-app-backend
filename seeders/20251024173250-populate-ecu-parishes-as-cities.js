/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable no-undef */
'use strict';

const parishesData = require('../data/ecuParishes.json');

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

		// Obtener todas las ciudades existentes en Ecuador
		const existingCities = await queryInterface.sequelize.query(
			`SELECT c.name, c."regionId" 
			 FROM city c 
			 JOIN region r ON c."regionId" = r.id 
			 WHERE r."countryId" = 2`,
			{ type: queryInterface.sequelize.QueryTypes.SELECT },
		);

		// Crear un Set para búsqueda rápida de ciudades existentes
		const existingCitiesSet = new Set(
			existingCities.map(city => `${city.name.toLowerCase()}-${city.regionId}`),
		);

		const citiesDataToInsert = [];
		let skippedCount = 0;
		let duplicatesInDataCount = 0;

		// Set para rastrear duplicados dentro del propio parishesData
		const parishesInJsonSet = new Set();

		parishesData.forEach(province => {
			const provinceNameCap = capitalizeWords(province.name);
			const regionId = provinceToRegionId[provinceNameCap];

			if (!regionId) {
				console.warn(`No se encontró región para: ${provinceNameCap}.`);
				return;
			}

			province.parishes.forEach(parish => {
				const parishNameCap = capitalizeWords(parish.name);
				const cityKey = `${parishNameCap.toLowerCase()}-${regionId}`;

				// Verificar si la parroquia está duplicada en el JSON
				if (parishesInJsonSet.has(cityKey)) {
					duplicatesInDataCount++;
					console.warn(
						`Parroquia duplicada en JSON: ${parishNameCap} (${provinceNameCap})`,
					);
					return;
				}

				// Agregar al Set para futuras verificaciones de duplicados en JSON
				parishesInJsonSet.add(cityKey);

				// Verificar si la parroquia ya existe en la base de datos
				if (existingCitiesSet.has(cityKey)) {
					skippedCount++;
					return;
				}

				citiesDataToInsert.push({
					name: parishNameCap,
					regionId,
					createdDate: new Date(),
					updatedDate: new Date(),
				});
			});
		});

		if (citiesDataToInsert.length === 0) {
			console.log('No hay parroquias nuevas para insertar. Todas ya existen.');
			if (duplicatesInDataCount > 0) {
				console.log(
					`Se encontraron ${duplicatesInDataCount} duplicados en el JSON.`,
				);
			}
			return;
		}

		const batchSize = 100;
		for (let i = 0; i < citiesDataToInsert.length; i += batchSize) {
			const batch = citiesDataToInsert.slice(i, i + batchSize);
			await queryInterface.bulkInsert('city', batch);
		}

		console.log(
			`Se insertaron ${citiesDataToInsert.length} parroquias nuevas como ciudades.`,
		);
		console.log(
			`Se omitieron ${skippedCount} parroquias que ya existían en la BD.`,
		);
		if (duplicatesInDataCount > 0) {
			console.log(
				`Se omitieron ${duplicatesInDataCount} parroquias duplicadas en el JSON.`,
			);
		}
	},

	async down(queryInterface) {
		// Obtener las regiones de Ecuador para el rollback
		const regions = await queryInterface.sequelize.query(
			'SELECT id FROM region WHERE "countryId" = 2',
			{ type: queryInterface.sequelize.QueryTypes.SELECT },
		);

		const regionIds = regions.map(r => r.id);

		// Eliminar solo las ciudades que corresponden a parroquias
		// Nota: Este método eliminará TODAS las parroquias del JSON,
		// no solo las que se insertaron en la última ejecución
		const parishNames = parishesData.flatMap(province =>
			province.parishes.map(parish => capitalizeWords(parish.name)),
		);

		const deletedRows = await queryInterface.bulkDelete('city', {
			name: parishNames,
			regionId: regionIds,
		});

		console.log(`Se eliminaron ${deletedRows} parroquias de la tabla city.`);
	},
};
