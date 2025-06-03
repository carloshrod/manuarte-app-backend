/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		await queryInterface.dropTable('city', { cascade: true }).catch(() => {});
		await queryInterface.dropTable('region', { cascade: true }).catch(() => {});
		await queryInterface
			.dropTable('country', { cascade: true })
			.catch(() => {});

		// country
		await queryInterface.createTable('country', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				allowNull: false,
				unique: true,
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
				unique: true,
			},
			isoCode: {
				type: Sequelize.STRING(2),
				allowNull: false,
				unique: true,
			},
			currency: {
				type: Sequelize.STRING(3),
				allowNull: false,
			},
			callingCode: {
				type: Sequelize.STRING(5),
				allowNull: true,
				unique: true,
			},
			utcTimezone: {
				type: Sequelize.STRING(50),
				allowNull: true,
			},
			createdDate: {
				allowNull: false,
				type: Sequelize.DATE,
				defaultValue: Sequelize.literal('NOW()'),
			},
			updatedDate: {
				allowNull: false,
				type: Sequelize.DATE,
				defaultValue: Sequelize.literal('NOW()'),
			},
		});

		// region
		await queryInterface.createTable('region', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				allowNull: false,
				unique: true,
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			countryId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'country',
					key: 'id',
				},
			},
			regionCode: {
				type: Sequelize.STRING(3),
				allowNull: true,
				unique: true,
			},
			createdDate: {
				allowNull: false,
				type: Sequelize.DATE,
				defaultValue: Sequelize.literal('NOW()'),
			},
			updatedDate: {
				allowNull: false,
				type: Sequelize.DATE,
				defaultValue: Sequelize.literal('NOW()'),
			},
		});

		// city
		await queryInterface.createTable('city', {
			id: {
				type: Sequelize.INTEGER,
				primaryKey: true,
				autoIncrement: true,
				allowNull: false,
				unique: true,
			},
			name: {
				type: Sequelize.STRING,
				allowNull: false,
			},
			regionId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: 'region',
					key: 'id',
				},
			},
			createdDate: {
				allowNull: false,
				type: Sequelize.DATE,
				defaultValue: Sequelize.literal('NOW()'),
			},
			updatedDate: {
				allowNull: false,
				type: Sequelize.DATE,
				defaultValue: Sequelize.literal('NOW()'),
			},
		});

		// Add cityId type integer to address table
		await queryInterface
			.removeConstraint('address', 'address_cityId_fkey')
			.catch(() => {});
		await queryInterface.removeColumn('address', 'cityId').catch(() => {});
		await queryInterface.addColumn('address', 'cityId', {
			type: Sequelize.INTEGER,
			allowNull: true,
			references: {
				model: 'city',
				key: 'id',
			},
		});
	},

	async down(queryInterface) {
		await queryInterface.removeColumn('address', 'cityId');

		await queryInterface.dropTable('city');
		await queryInterface.dropTable('region');
		await queryInterface.dropTable('country');
	},
};
