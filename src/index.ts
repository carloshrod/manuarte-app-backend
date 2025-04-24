import { ENV } from './config/env';
import { connectToDatabase, startDBReconnectLoop } from './config/database';
import app from './app';

const PORT = ENV.PORT ?? 5000;

async function main() {
	try {
		await connectToDatabase()
		startDBReconnectLoop();

		app.listen(PORT, () => {
			console.log(`✅ Server listening on port ${PORT}`);
		});
	} catch (error) {
		console.error('🚨 Fatal error in server startup:', error);
	}
}

main();
