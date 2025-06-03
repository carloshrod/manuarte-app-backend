/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.bulkInsert('country', [
			{
				name: 'Colombia',
				isoCode: 'CO',
				currency: 'COP',
				callingCode: '+57',
				utcTimezone: 'UTC-05:00',
				createdDate: new Date(),
				updatedDate: new Date(),
			},
			{
				name: 'Ecuador',
				isoCode: 'EC',
				currency: 'USD',
				callingCode: '+593',
				utcTimezone: 'UTC-05:00',
				createdDate: new Date(),
				updatedDate: new Date(),
			},
		]);
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.bulkDelete('country', {
			isoCode: { [Sequelize.Op.in]: ['CO', 'EC'] },
		});
	},
};
