/* eslint-disable no-undef */
'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		// Crear columna temporal
		await queryInterface.addColumn('product', 'tempCategoryProductId', {
			type: Sequelize.UUID,
			allowNull: true,
		});

		// Copiar datos de 'categoryProductId' a 'tempCategoryProductId' convirtiéndolos a UUID
		await queryInterface.sequelize.query(`
			UPDATE "product"
			SET "tempCategoryProductId" = "categoryProductId"::UUID
		`);

		// Eliminar columna original
		await queryInterface.removeColumn('product', 'categoryProductId');

		// Renombrar columna temporal al nombre original
		await queryInterface.renameColumn(
			'product',
			'tempCategoryProductId',
			'categoryProductId',
		);

		// Asegurarse de que la columna no permita nulos
		await queryInterface.changeColumn('product', 'categoryProductId', {
			type: Sequelize.UUID,
			allowNull: false,
		});
	},

	async down(queryInterface, Sequelize) {
		// Crear columna temporal con tipo TEXT
		await queryInterface.addColumn('product', 'tempCategoryProductId', {
			type: Sequelize.TEXT,
			allowNull: true,
		});

		// Copiar datos de 'categoryProductId' a 'tempCategoryProductId' convirtiéndolos a TEXT
		await queryInterface.sequelize.query(`
		UPDATE "product"
		SET "tempCategoryProductId" = "categoryProductId"::TEXT
	`);

		// Eliminar columna actual con tipo UUID
		await queryInterface.removeColumn('product', 'categoryProductId');

		// Renombrar columna temporal al nombre original
		await queryInterface.renameColumn(
			'product',
			'tempCategoryProductId',
			'categoryProductId',
		);

		//  Asegurarse de que la columna no permita nulos
		await queryInterface.changeColumn('product', 'categoryProductId', {
			type: Sequelize.TEXT,
			allowNull: false,
		});
	},
};
