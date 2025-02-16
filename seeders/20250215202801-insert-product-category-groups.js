/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const categoryGroups = [
			'ACEITES',
			'BASES',
			'CERAS',
			'COLORANTES',
			'ENVASES',
			'EXTRACTOS',
			'FRAGANCIAS',
			'GELES',
			'INGREDIENTES',
			'MECHAS',
			'MICAS',
			'MOLDES',
			'UTENSILIOS',
			'VARIOS',
		];

		const categoryData = categoryGroups.map(name => ({
			id: Sequelize.literal('uuid_generate_v4()'),
			name,
			createdDate: new Date(),
			updatedDate: new Date(),
		}));

		await queryInterface.bulkInsert('product_category_group', categoryData);
	},

	async down(queryInterface) {
		await queryInterface.bulkDelete('product_category_group', null, {});
	},
};
