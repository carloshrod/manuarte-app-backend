/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('shop', 'slug', {
			type: Sequelize.STRING,
			allowNull: true,
		});

		await queryInterface.sequelize.query(`
			UPDATE shop
			SET slug = LOWER(REPLACE(name, ' ', '-'));
		`);

		await queryInterface.changeColumn('shop', 'slug', {
			type: Sequelize.STRING,
			allowNull: false,
		});

		await queryInterface.addConstraint('shop', {
			fields: ['slug'],
			type: 'unique',
			name: 'unique_slug_constraint',
		});
	},

	async down(queryInterface) {
		await queryInterface.removeConstraint('shop', 'unique_slug_constraint');

		await queryInterface.removeColumn('shop', 'slug');
	},
};
