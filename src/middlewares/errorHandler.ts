/* eslint-disable @typescript-eslint/no-unused-vars */
import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

interface CustomError extends Error {
	status?: number;
}

export const errorHandler: ErrorRequestHandler = (
	err: CustomError,
	_req: Request,
	res: Response,
	next: NextFunction,
) => {
	console.error('Error log:', err);

	const statusCode = err.status || 500;
	const message = err.message || 'Error interno del servidor';

	res.status(statusCode).json({
		message,
	});
};
