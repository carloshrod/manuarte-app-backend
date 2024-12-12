import { ENV } from './config/env';
import { sequelize } from './config/database';
import app from './app';

const PORT = ENV.PORT ?? 5000;

async function main() {
	try {
		await sequelize.sync();
		console.log('********** Connected to database successfully **********');
		app.listen(PORT, () => {
			console.log(`********** Server listening on port ${PORT} **********`);
		});
	} catch (error) {
		console.error('Unable to connect to the database:', error);
	}
}

main();
