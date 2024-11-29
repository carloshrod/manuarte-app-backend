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
				const { status, accessToken, refreshToken } = result;

				res.cookie('jwt', refreshToken, {
					httpOnly: true,
					secure: true,
					sameSite: 'none',
					maxAge: 24 * 60 * 60 * 1000,
				});

				// Send authorization roles and access token to user
				// res.json({ roles, accessToken });
				res.status(status).json({ accessToken });
			} else {
				res.sendStatus(result.status);
			}
		} catch (error) {
			next(error);
		}
	};

	refreshToken: Handler = async (req, res, next) => {
		try {
			const result = await this.authService.refreshToken(req.cookies);

			if (result.accessToken) {
				res.status(result.status).json({ accessToken: result.accessToken });
			} else {
				res.sendStatus(result.status);
			}
		} catch (error) {
			next(error);
		}
	};

	logout: Handler = async (req, res, next) => {
		try {
			const result = await this.authService.logout(req.cookies);

			if (result.clearCookie) {
				res.clearCookie('jwt', {
					httpOnly: true,
					sameSite: 'none',
					secure: true,
				});
			}

			res.sendStatus(result.status);
		} catch (error) {
			next(error);
		}
	};
}
