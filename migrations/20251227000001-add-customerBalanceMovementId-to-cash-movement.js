/* eslint-disable no-undef */
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn(
			'cash_movement',
			'customerBalanceMovementId',
			{
				type: Sequelize.UUID,
				allowNull: true,
				references: {
					model: 'customer_balance_movement',
					key: 'id',
				},
				onUpdate: 'CASCADE',
				onDelete: 'SET NULL',
			},
		);
	},

	down: async queryInterface => {
		await queryInterface.removeColumn(
			'cash_movement',
			'customerBalanceMovementId',
		);
	},
};
