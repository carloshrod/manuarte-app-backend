import { NextFunction, Request, Response } from 'express';

const allowedOrigins = ['http://localhost:3000'];

export const credentials = (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const origin = req.headers.origin;
	if (allowedOrigins.includes(origin as string)) {
		res.header('Access-Control-Allow-Credentials', 'true');
	}
	next();
};
