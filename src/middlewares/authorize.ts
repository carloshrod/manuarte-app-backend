import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { RoleModel } from '../modules/role/model';
import { DecodedToken } from '../modules/auth/types';
import { PermissionModel } from '../modules/permission/model';
import { UserModel } from '../modules/user/model';

export const authorize = (permissionName: string) => {
	return async (
		req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		try {
			const authHeader = req.headers.authorization || req.headers.Authorization;
			if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
				res.sendStatus(401);
				return;
			}
			const token = authHeader.split(' ')[1];

			const decoded = jwt.verify(
				token,
				env.ACCESS_TOKEN_SECRET,
			) as DecodedToken;

			const roleId = decoded.UserInfo.role;
			const userId = decoded.UserInfo.id;
			const allowed = await hasPermission(roleId, userId, permissionName);

			if (!allowed) {
				const isGet = req.method === 'GET';

				const message = isGet
					? 'No tienes permisos para acceder a este recurso'
					: 'No tienes permisos para realizar esta acción';
				res.status(403).json({ message });
				return;
			}
			next();
		} catch (error) {
			console.error('Authorization error:', error);
			res.sendStatus(500);
		}
	};
};

async function hasPermission(
	roleId: string,
	userId: string,
	permissionName: string,
) {
	const role = await RoleModel.findByPk(roleId, { attributes: ['id'] });
	const user = await UserModel.findByPk(userId, { attributes: ['id'] });
	if (!role || !user) return false;

	const permission = await PermissionModel.findOne({
		where: { name: permissionName },
		attributes: ['id'],
	});
	if (!permission) return false;

	const roleHasPermission = await role.hasPermission(permission.id);
	const userHasExtraPermission = await user?.hasExtraPermission(permission.id);

	return roleHasPermission || userHasExtraPermission;
}