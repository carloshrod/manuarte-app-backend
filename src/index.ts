import { ENV } from './config/env';
import { connectToDatabase, startDBReconnectLoop } from './config/database';
import { connectToRedis } from './config/redis';
import app from './app';

const PORT = ENV.PORT ?? 5000;

async function main() {
	try {
		await connectToDatabase();
		startDBReconnectLoop();
		await connectToRedis();

		app.listen(PORT, () => {
			console.log(`✅ Server listening on port ${PORT}`);
		});
	} catch (error) {
		console.error('🚨 Fatal error in server startup:', error);
	}
}

main();
