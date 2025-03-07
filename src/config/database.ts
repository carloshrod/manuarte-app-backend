import { Sequelize } from 'sequelize';
import { ENV } from './env';

const { DB_NAME, DB_USER, DB_PASSWORD, DB_HOST } = ENV;

export const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
	host: DB_HOST,
	dialect: 'postgres',
	pool: {
		max: 5,
		min: 1,
		acquire: 30000,
		idle: 10000,
	},
});
