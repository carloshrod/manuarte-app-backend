import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { DecodedToken } from '../modules/auth/types';

interface AuthenticatedRequest extends Request {
	id?: string;
}

export const verifyJWT = (
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
) => {
	const authHeader = req.headers.authorization || req.headers.Authorization;
	if (typeof authHeader !== 'string') return res.sendStatus(401);

	if (!authHeader?.startsWith('Bearer ')) return res.sendStatus(401);
	const token = authHeader.split(' ')[1];

	jwt.verify(token, env.ACCESS_TOKEN_SECRET, (err, decoded) => {
		if (err) return res.sendStatus(403);

		if (decoded && typeof decoded === 'object' && 'UserInfo' in decoded) {
			req.id = (decoded as DecodedToken).UserInfo.id;
			next();
		} else {
			return res.sendStatus(403);
		}
	});
};
