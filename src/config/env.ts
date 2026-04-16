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
	WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
	WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
	WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
	OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
	WHATSAPP_BOT_USER_ID: process.env.WHATSAPP_BOT_USER_ID ?? '',
	REDIS_HOST: process.env.REDIS_HOST ?? '127.0.0.1',
	REDIS_PORT: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
	REDIS_PASSWORD: process.env.REDIS_PASSWORD,
};
