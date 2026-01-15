/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('quote', 'priceTypeId', {
			type: Sequelize.UUID,
			allowNull: true,
			references: {
				model: 'price_type',
				key: 'id',
			},
			onUpdate: 'CASCADE',
			onDelete: 'RESTRICT',
		});

		// Establecer PVP como default para quotes existentes
		await queryInterface.sequelize.query(`
            UPDATE quote 
            SET "priceTypeId" = (
                SELECT id FROM price_type WHERE code = 'PVP' LIMIT 1
            )
            WHERE "priceTypeId" IS NULL;
        `);

		// Hacer la columna NOT NULL
		await queryInterface.changeColumn('quote', 'priceTypeId', {
			type: Sequelize.UUID,
			allowNull: false,
			references: {
				model: 'price_type',
				key: 'id',
			},
			onUpdate: 'CASCADE',
			onDelete: 'RESTRICT',
		});

		// Agregar índice
		await queryInterface.addIndex('quote', ['priceTypeId'], {
			name: 'idx_quote_price_type',
		});
	},

	async down(queryInterface) {
		await queryInterface.removeIndex('quote', 'idx_quote_price_type');
		await queryInterface.removeColumn('quote', 'priceTypeId');
	},
};
