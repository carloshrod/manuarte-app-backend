/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		// Agregar el nuevo valor al ENUM de category
		await queryInterface.sequelize.query(`
			ALTER TYPE "enum_cash_movement_category" 
			ADD VALUE IF NOT EXISTS 'ADVANCE_PAYMENT';
		`);
	},

	async down(queryInterface) {
		await queryInterface.sequelize.query(`
			-- No se puede eliminar valores de un ENUM en PostgreSQL
			-- Se requeriría recrear el tipo completo
		`);
	},
};
