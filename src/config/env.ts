import dotenv from 'dotenv';

dotenv.config();

const env = process.env.NODE_ENV || 'development';
dotenv.config({ path: `.env.${env}` });

export const ENV = {
	PORT: process.env.PORT,
	DB_NAME: process.env.DB_NAME ?? '',
	DB_USER: process.env.DB_USER ?? '',
	DB_PASSWORD: process.env.DB_PASSWORD ?? '',
	DB_HOST: process.env.DB_HOST ?? '',
	ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET ?? '',
	REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET ?? '',
	CLIENT_URL: process.env.CLIENT_URL ?? '',
};
