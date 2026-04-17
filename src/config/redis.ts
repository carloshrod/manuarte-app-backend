import Redis from 'ioredis';
import { ENV } from './env';

const { REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = ENV;

export const redis = new Redis({
	host: REDIS_HOST,
	port: REDIS_PORT,
	password: REDIS_PASSWORD,
	lazyConnect: true,
});

// Evita logs repetitivos de error de conexión
let hasLoggedConnRefused = false;
interface ErrorWithCode extends Error {
	code?: string;
}
redis.on('error', (err: unknown) => {
	let code: string | undefined = undefined;
	if (typeof err === 'object' && err !== null && 'code' in err) {
		code = (err as ErrorWithCode).code;
	}
	if (code === 'ECONNREFUSED') {
		if (!hasLoggedConnRefused) {
			console.warn(
				'[Redis error] Connection refused (ECONNREFUSED). Redis is optional, system will continue.',
			);
			hasLoggedConnRefused = true;
		}
		return;
	}
	console.warn(
		'[Redis error]',
		err instanceof Error ? err.message : String(err),
	);
});

export async function connectToRedis(retries = 5, delay = 5000) {
	while (retries > 0) {
		try {
			await redis.connect();
			await redis.ping();
			console.log('✅ Connected to Redis successfully');
			return;
		} catch (error) {
			console.error(`❌ Redis connection failed. Retries left: ${retries - 1}`);
			if (error instanceof Error) {
				console.error(error.message);
			} else {
				console.error('Unknown error:', error);
			}

			retries--;
			if (retries > 0) {
				await new Promise(res => setTimeout(res, delay));
			}
		}
	}

	console.error('🚨 Failed to connect to Redis after multiple attempts.');
}
