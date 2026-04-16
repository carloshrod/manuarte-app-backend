'use strict';

import { hash } from 'bcrypt';
import { randomUUID } from 'crypto';

const BOT_DNI = 'BOT-WHATSAPP';
const BOT_EMAIL = 'whatsapp-bot@manuarte.com';

/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface) {
	const cajeroRoleId = await queryInterface.rawSelect(
		'role',
		{ where: { name: 'cajero' } },
		['id'],
	);

	if (!cajeroRoleId) {
		throw new Error('Role "cajero" not found. Run role seeders first.');
	}

	// Check if bot person already exists
	const existingPerson = await queryInterface.rawSelect(
		'person',
		{ where: { dni: BOT_DNI } },
		['id'],
	);

	if (existingPerson) {
		console.log('WhatsApp bot user already exists, skipping.');
		return;
	}

	const personId = randomUUID();
	const userId = randomUUID();
	const hashedPassword = await hash(randomUUID(), 10);

	await queryInterface.bulkInsert('person', [
		{
			id: personId,
			fullName: 'WhatsApp Bot',
			dni: BOT_DNI,
			createdDate: new Date(),
			updatedDate: new Date(),
		},
	]);

	await queryInterface.bulkInsert('user', [
		{
			id: userId,
			email: BOT_EMAIL,
			password: hashedPassword,
			roleId: cajeroRoleId,
			isActive: true,
			personId,
			shopId: null,
			createdDate: new Date(),
			updatedDate: new Date(),
		},
	]);

	console.log(`WhatsApp bot user created. userId: ${userId}`);
	console.log('Set WHATSAPP_BOT_USER_ID in your .env file with this value.');
}

export async function down(queryInterface) {
	const personId = await queryInterface.rawSelect(
		'person',
		{ where: { dni: BOT_DNI } },
		['id'],
	);

	if (personId) {
		await queryInterface.bulkDelete('user', { personId });
		await queryInterface.bulkDelete('person', { id: personId });
	}
}
