import { UserModel } from '../user/model';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { ENV } from '../../config/env';
import { Request } from 'express';
import { DecodedRefreshToken } from './types';
import { RoleModel } from '../role/model';

export class AuthService {
	private userModel;
	private roleModel;

	constructor(userModel: typeof UserModel) {
		this.userModel = userModel;
		this.roleModel = RoleModel;
	}

	login = async ({ email, password }: { email: string; password: string }) => {
		try {
			const foundUser = await this.userModel.findOne({
				where: { email },
				attributes: ['id', 'email', 'password', 'roleId'],
			});
			if (!foundUser) {
				return { status: 401, message: 'Invalid credentials' };
			}

			const match = await bcrypt.compare(password, foundUser.password);
			if (!match) return { status: 401, message: 'Invalid credentials' };

			const { accessToken, refreshToken } =
				(await this.generateJWTs(foundUser)) ?? {};

			await foundUser.update({
				refreshToken,
			});

			return {
				status: 200,
				userId: foundUser.id,
				email: foundUser.email,
				accessToken,
				refreshToken,
			};
		} catch (error) {
			console.error(error);
			throw new Error('Authentication error');
		}
	};

	refreshTokens = async (headers: Request['headers']) => {
		const authHeader = headers.authorization || headers.Authorization;
		if (typeof authHeader !== 'string' || !authHeader?.startsWith('Bearer ')) {
			return { status: 401, message: 'User not authenticated' };
		}

		const refreshToken = authHeader.split(' ')[1];

		try {
			const decodedToken = jwt.verify(
				refreshToken,
				ENV.REFRESH_TOKEN_SECRET,
			) as DecodedRefreshToken;

			const foundUser = await this.userModel.findByPk(decodedToken.id, {
				attributes: ['id', 'email', 'roleId', 'refreshToken'],
			});
			if (!foundUser) {
				return { status: 401, message: 'User not authenticated' };
			}

			const validRefreshToken = await bcrypt.compare(
				refreshToken,
				foundUser.refreshToken,
			);
			if (!validRefreshToken) {
				return { status: 401, message: 'Invalid token' };
			}

			const { accessToken, refreshToken: newRefreshToken } =
				(await this.generateJWTs(foundUser)) ?? {};

			await foundUser.update({ refreshToken: newRefreshToken });

			return { status: 200, accessToken, refreshToken: newRefreshToken };
		} catch (error) {
			console.error(error);
			return { status: 401, message: 'Invalid or expired token' };
		}
	};

	logout = async (headers: Request['headers']) => {
		const authHeader = headers.authorization || headers.Authorization;
		if (typeof authHeader !== 'string' || !authHeader?.startsWith('Bearer ')) {
			return { status: 204, message: 'No content' };
		}

		const refreshToken = authHeader.split(' ')[1];

		const decoded = jwt.verify(
			refreshToken,
			ENV.REFRESH_TOKEN_SECRET,
		) as DecodedRefreshToken;

		const foundUser = await this.userModel.findByPk(decoded.id, {
			attributes: ['id'],
		});
		if (!foundUser) return { status: 204, message: 'User not found' };

		await foundUser.update({ refreshToken: null });

		return { status: 204 };
	};

	private generateJWTs = async (user: UserModel) => {
		try {
			const accessToken = jwt.sign(
				{
					user: {
						id: user.id,
						email: user.email,
						roleId: user.roleId,
						roleName: await this.getRoleName(user.roleId),
						extraPermissions: (await user.getExtraPermissions()).map(
							permission => permission.name,
						),
					},
				},
				ENV.ACCESS_TOKEN_SECRET,
				{ expiresIn: '15m' },
			);

			const refreshToken = jwt.sign({ id: user.id }, ENV.REFRESH_TOKEN_SECRET, {
				expiresIn: '7d',
			});

			return { accessToken, refreshToken };
		} catch (error) {
			console.error(error);
			return { status: 500, message: 'Error generando tokens' };
		}
	};

	private getRoleName = async (id: string) => {
		try {
			const role = await this.roleModel.findByPk(id, {
				attributes: ['name'],
			});
			if (!role) throw new Error('Rol no encontrado');

			return role.name;
		} catch (error) {
			console.error(error);
			throw error;
		}
	};
}
