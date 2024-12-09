import { CorsOptions } from 'cors';

const allowedOrigins = ['http://localhost:3000'];

export const corsOptions: CorsOptions = {
	origin: (
		origin: string | undefined,
		callback: (err: Error | null, allow?: boolean) => void,
	) => {
		if ((origin && allowedOrigins.indexOf(origin) !== -1) || !origin) {
			callback(null, true);
		} else {
			callback(new Error('Not allowed by CORS'));
		}
	},
	optionsSuccessStatus: 200,
};
