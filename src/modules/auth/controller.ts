import { Handler } from 'express';
import { AuthService } from './service';

export class AuthController {
	private authService;

	constructor(authService: AuthService) {
		this.authService = authService;
	}

	login: Handler = async (req, res, next) => {
		try {
			const { email, password } = req.body;

			const result = await this.authService.login({ email, password });

			if (result.status === 200) {
				const { status, userId, email, accessToken, refreshToken } = result;

				// res.cookie('jwt', refreshToken, {
				// 	httpOnly: true,
				// 	secure: true,
				// 	sameSite: 'none',
				// 	maxAge: 24 * 60 * 60 * 1000,
				// });

				// Send authorization user info and access token
				res.status(status).json({ userId, email, accessToken, refreshToken });
			} else {
				res.sendStatus(result.status);
			}
		} catch (error) {
			next(error);
		}
	};

	refreshTokens: Handler = async (req, res, next) => {
		try {
			const result = await this.authService.refreshTokens(req.headers);

			if (result.accessToken && result.refreshToken) {
				res.status(result.status).json({
					accessToken: result.accessToken,
					refreshToken: result.refreshToken,
				});
			} else {
				res.sendStatus(result.status);
			}
		} catch (error) {
			next(error);
		}
	};

	logout: Handler = async (req, res, next) => {
		try {
			const result = await this.authService.logout(req.headers);

			res.sendStatus(result.status);
		} catch (error) {
			next(error);
		}
	};
}
