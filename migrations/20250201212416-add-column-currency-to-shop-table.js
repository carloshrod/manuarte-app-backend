/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
		await queryInterface.addColumn('shop', 'currency', {
			type: Sequelize.STRING,
			allowNull: false,
      defaultValue: "COP"
		});
  },

  async down (queryInterface) {
    await queryInterface.removeColumn('shop', 'currency');
  }
};
