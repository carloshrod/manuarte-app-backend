/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.createTable('price_type', {
			id: {
				type: Sequelize.UUID,
				primaryKey: true,
				allowNull: false,
				defaultValue: Sequelize.literal('uuid_generate_v4()'),
			},
			code: {
				type: Sequelize.STRING(10),
				allowNull: false,
				unique: true,
			},
			name: {
				type: Sequelize.STRING(50),
				allowNull: false,
			},
			description: {
				type: Sequelize.TEXT,
				allowNull: true,
			},
			isDefault: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: false,
			},
			isActive: {
				type: Sequelize.BOOLEAN,
				allowNull: false,
				defaultValue: true,
			},
			createdDate: {
				type: Sequelize.DATE,
				allowNull: false,
				defaultValue: Sequelize.literal('NOW()'),
			},
		});

		await queryInterface.addIndex('price_type', ['code'], {
			name: 'idx_price_type_code',
			unique: true,
		});

		await queryInterface.addIndex('price_type', ['isActive'], {
			name: 'idx_price_type_active',
		});
	},

	async down(queryInterface) {
		await queryInterface.dropTable('price_type');
	},
};
