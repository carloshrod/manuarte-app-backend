'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.addColumn('quote', 'shipping', {
			type: Sequelize.DECIMAL,
			allowNull: true,
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('quote', 'shipping');
	},
};
