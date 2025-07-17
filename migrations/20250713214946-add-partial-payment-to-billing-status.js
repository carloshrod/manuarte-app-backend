/* eslint-disable no-undef */
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
	async up(queryInterface) {
		await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          JOIN pg_enum e ON t.oid = e.enumtypid
          WHERE t.typname = 'enum_billing_status'
            AND e.enumlabel = 'PARTIAL_PAYMENT'
        ) THEN
          ALTER TYPE "enum_billing_status" ADD VALUE 'PARTIAL_PAYMENT';
        END IF;
      END
      $$;
    `);
	},

	async down() {
		console.warn(
			'❗ Down migration not supported: Cannot remove enum value PARTIAL_PAYMENT without recreating the enum type.',
		);
	},
};
