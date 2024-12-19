import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { DecodedAccessToken } from '../modules/auth/types';
import { NextFunction, Response } from 'express';
import { CustomRequest } from '../modules/types';

export const verifyJWT = (
	req: CustomRequest,
	res: Response,
	next: NextFunction,
) => {
	try {
		const authHeader = req.headers.authorization || req.headers.Authorization;
		if (typeof authHeader !== 'string' || !authHeader?.startsWith('Bearer '))
			return res.sendStatus(401);

		const token = authHeader.split(' ')[1];

		const decodedAccessToken = jwt.verify(
			token,
			ENV.ACCESS_TOKEN_SECRET,
		) as DecodedAccessToken;

		if (!decodedAccessToken.user) {
			return res.sendStatus(403);
		}

		req.requestedBy = decodedAccessToken.user.id;
		next();
	} catch (error) {
		console.error(error);
		return res.sendStatus(403);
	}
};
