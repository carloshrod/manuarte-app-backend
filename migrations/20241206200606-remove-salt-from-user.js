/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.removeColumn('user', 'salt');
	},

	async down(queryInterface, Sequelize) {
		await queryInterface.addColumn('user', 'salt', {
			type: Sequelize.STRING,
			allowNull: false,
			defaultValue: 'temporary_salt',
		});

		const [users] = await queryInterface.sequelize.query(`
      SELECT id, password FROM "user";
    `);

		const updates = users.map(async user => {
			const salt = user.password.substring(0, 29);
			await queryInterface.sequelize.query(
				`
        UPDATE "user"
        SET salt = :salt
        WHERE id = :id;
      `,
				{
					replacements: { salt, id: user.id },
				},
			);
		});

		await Promise.all(updates);
	},
};
