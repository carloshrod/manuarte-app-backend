import { UserModel } from '../user/model';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { DecodedToken } from './types';
import { Request } from 'express';

export class AuthService {
	private userModel;

	constructor(userModel: typeof UserModel) {
		this.userModel = userModel;
	}

	login = async ({ email, password }: { email: string; password: string }) => {
		const foundUser = await this.userModel.findOne({ where: { email } });
		if (!foundUser) {
			return { status: 401, message: 'User not found' };
		}

		try {
			// evaluate password
			const match = await bcrypt.compare(password, foundUser.password);
			if (!match) return { status: 401, message: 'Invalid credentials' };

			// const roles = Object.values(foundUser.roles).filter(Boolean);
			// create JWTs
			const accessToken = jwt.sign(
				{
					UserInfo: {
						id: foundUser.id,
						email: foundUser.email,
						// roles: roles,
					},
				},
				env.ACCESS_TOKEN_SECRET,
				{ expiresIn: '15s' },
			);

			const refreshToken = jwt.sign(
				{ id: foundUser.id },
				env.REFRESH_TOKEN_SECRET,
				{ expiresIn: '1d' },
			);

			// Saving refreshToken with current user
			await foundUser.update({ refreshToken });
			// console.log(roles);

			// Send authorization roles and access token to user
			// return { roles, accessToken };
			return { status: 200, accessToken, refreshToken };
		} catch (error) {
			console.error(error);
			throw new Error('Authentication error');
		}
	};

	refreshToken = async (cookies: Request['cookies']) => {
		if (!cookies?.jwt) {
			return { status: 401, message: 'User not authenticated' };
		}

		const refreshToken = cookies.jwt;

		const foundUser = await this.userModel.findOne({ where: { refreshToken } });
		if (!foundUser) {
			return { status: 401, message: 'User not authenticated' };
		}

		// evaluate jwt
		try {
			const decoded = jwt.verify(
				refreshToken,
				env.REFRESH_TOKEN_SECRET,
			) as DecodedToken;

			if (foundUser.id !== decoded.id) {
				return { status: 401, message: 'User not authenticated' };
			}

			// const roles = Object.values(foundUser.roles);
			const accessToken = jwt.sign(
				{
					UserInfo: {
						id: decoded.id,
						email: decoded.email,
					},
				},
				env.ACCESS_TOKEN_SECRET,
				{ expiresIn: '15s' },
			);

			// return { roles, accessToken };
			return { status: 200, accessToken };
		} catch (error) {
			console.error(error);
			throw new Error('Invalid or expired token');
		}
	};

	logout = async (cookies: Request['cookies']) => {
		if (!cookies?.jwt) return { status: 204, message: 'No content' };
		const refreshToken = cookies.jwt;

		const foundUser = await this.userModel.findOne({ where: { refreshToken } });

		if (!foundUser)
			return { status: 204, clearCookie: true, message: 'User not found' };

		await foundUser.update({ refreshToken: null });

		return { status: 204, clearCookie: true };
	};
}
