/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		// Eliminar columna 'categoryId' (antigua clave foránea)
		await queryInterface.removeColumn('product', 'categoryId');

		// Agregar restricción de clave foránea a 'categoryProductId'
		await queryInterface.addConstraint('product', {
			fields: ['categoryProductId'],
			type: 'foreign key',
			name: 'fk_product_categoryProductId',
			references: {
				table: 'category_product',
				field: 'id',
			},
			onUpdate: 'CASCADE',
		});
	},

	async down(queryInterface, Sequelize) {
		// Quitar restricción de clave foránea de 'categoryProductId'
		await queryInterface.removeConstraint(
			'product',
			'fk_product_categoryProductId',
		);

		// Restaurar columna 'categoryId' como clave foránea
		await queryInterface.addColumn('product', 'categoryId', {
			type: Sequelize.UUID,
			allowNull: true,
			references: {
				model: 'category_product',
				key: 'id',
			},
			onUpdate: 'CASCADE',
		});
	},
};
