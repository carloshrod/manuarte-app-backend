/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		const regions = [
			// Colombia
			{ name: 'Amazonas', countryId: 1, regionCode: 'AMA' },
			{ name: 'Antioquia', countryId: 1, regionCode: 'ANT' },
			{ name: 'Arauca', countryId: 1, regionCode: 'ARA' },
			{ name: 'Atlántico', countryId: 1, regionCode: 'ATL' },
			{ name: 'Bolívar', countryId: 1, regionCode: 'BOL' },
			{ name: 'Boyacá', countryId: 1, regionCode: 'BOY' },
			{ name: 'Caldas', countryId: 1, regionCode: 'CAL' },
			{ name: 'Caquetá', countryId: 1, regionCode: 'CAQ' },
			{ name: 'Casanare', countryId: 1, regionCode: 'CAS' },
			{ name: 'Cauca', countryId: 1, regionCode: 'CAU' },
			{ name: 'Cesar', countryId: 1, regionCode: 'CES' },
			{ name: 'Chocó', countryId: 1, regionCode: 'CHO' },
			{ name: 'Córdoba', countryId: 1, regionCode: 'COR' },
			{ name: 'Cundinamarca', countryId: 1, regionCode: 'CUN' },
			{ name: 'Guainía', countryId: 1, regionCode: 'GUA' },
			{ name: 'Guaviare', countryId: 1, regionCode: 'GUV' },
			{ name: 'Huila', countryId: 1, regionCode: 'HUI' },
			{ name: 'La Guajira', countryId: 1, regionCode: 'LAG' },
			{ name: 'Magdalena', countryId: 1, regionCode: 'MAG' },
			{ name: 'Meta', countryId: 1, regionCode: 'MET' },
			{ name: 'Nariño', countryId: 1, regionCode: 'NAR' },
			{ name: 'Norte de Santander', countryId: 1, regionCode: 'NDS' },
			{ name: 'Putumayo', countryId: 1, regionCode: 'PUT' },
			{ name: 'Quindío', countryId: 1, regionCode: 'QUI' },
			{ name: 'Risaralda', countryId: 1, regionCode: 'RIS' },
			{
				name: 'San Andrés, Providencia y Santa Catalina',
				countryId: 1,
				regionCode: 'SAP',
			},
			{ name: 'Santander', countryId: 1, regionCode: 'SAN' },
			{ name: 'Sucre', countryId: 1, regionCode: 'SUC' },
			{ name: 'Tolima', countryId: 1, regionCode: 'TOL' },
			{ name: 'Valle del Cauca', countryId: 1, regionCode: 'VAC' },
			{ name: 'Vaupés', countryId: 1, regionCode: 'VAU' },
			{ name: 'Vichada', countryId: 1, regionCode: 'VIC' },

			// Ecuador
			{ name: 'Azuay', countryId: 2, regionCode: 'AZU' },
			{ name: 'Bolívar', countryId: 2, regionCode: 'BLV' },
			{ name: 'Cañar', countryId: 2, regionCode: 'CAN' },
			{ name: 'Carchi', countryId: 2, regionCode: 'CCH' },
			{ name: 'Chimborazo', countryId: 2, regionCode: 'CHI' },
			{ name: 'Cotopaxi', countryId: 2, regionCode: 'CTP' },
			{ name: 'El Oro', countryId: 2, regionCode: 'EOR' },
			{ name: 'Esmeraldas', countryId: 2, regionCode: 'ESM' },
			{ name: 'Guayas', countryId: 2, regionCode: 'GYA' },
			{ name: 'Imbabura', countryId: 2, regionCode: 'IMB' },
			{ name: 'Loja', countryId: 2, regionCode: 'LOJ' },
			{ name: 'Los Ríos', countryId: 2, regionCode: 'LRI' },
			{ name: 'Manabí', countryId: 2, regionCode: 'MAN' },
			{ name: 'Morona Santiago', countryId: 2, regionCode: 'MSA' },
			{ name: 'Napo', countryId: 2, regionCode: 'NAP' },
			{ name: 'Orellana', countryId: 2, regionCode: 'ORE' },
			{ name: 'Pastaza', countryId: 2, regionCode: 'PAS' },
			{ name: 'Pichincha', countryId: 2, regionCode: 'PCH' },
			{ name: 'Santa Elena', countryId: 2, regionCode: 'STE' },
			{ name: 'Santo Domingo', countryId: 2, regionCode: 'STD' },
			{ name: 'Sucumbíos', countryId: 2, regionCode: 'SCM' },
			{ name: 'Tungurahua', countryId: 2, regionCode: 'TUN' },
			{ name: 'Zamora Chinchipe', countryId: 2, regionCode: 'ZCH' },
			{ name: 'Galápagos', countryId: 2, regionCode: 'GAL' },
		];

		await queryInterface.bulkInsert('region', regions);
	},

	async down(queryInterface) {
		await queryInterface.bulkDelete('region', null, {});
	},
};
