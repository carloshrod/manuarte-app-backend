/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const priceTypes = [
			{
				id: Sequelize.literal('uuid_generate_v4()'),
				code: 'PVP',
				name: 'Precio Venta Público',
				description: 'Precio estándar para clientes finales',
				isDefault: true,
				isActive: true,
				createdDate: new Date(),
			},
			{
				id: Sequelize.literal('uuid_generate_v4()'),
				code: 'DIS',
				name: 'Precio Distribuidor',
				description: 'Precio especial para distribuidores y mayoristas',
				isDefault: false,
				isActive: true,
				createdDate: new Date(),
			},
		];

		await queryInterface.bulkInsert('price_type', priceTypes);
	},

	async down(queryInterface) {
		await queryInterface.bulkDelete('price_type', {
			code: ['PVP', 'DIS'],
		});
	},
};
