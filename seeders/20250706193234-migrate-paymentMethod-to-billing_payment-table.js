/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface, Sequelize) {
		const billings = await queryInterface.sequelize.query(
			`SELECT id, "paymentMethod", subtotal, shipping FROM billing WHERE "paymentMethod" IS NOT NULL`,
			{ type: Sequelize.QueryTypes.SELECT },
		);

		const payments = billings.map(billing => ({
			id: Sequelize.literal('uuid_generate_v4()'),
			billingId: billing.id,
			paymentMethod: billing.paymentMethod,
			amount: Number(billing.subtotal) + Number(billing.shipping),
			paymentReference: null,
			createdDate: new Date(),
			updatedDate: new Date(),
		}));

		if (payments.length > 0) {
			await queryInterface.bulkInsert('billing_payment', payments);
		}
	},

	async down(queryInterface) {
		await queryInterface.bulkDelete('billing_payment', null, {});
	},
};
