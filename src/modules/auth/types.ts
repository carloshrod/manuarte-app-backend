import { JwtPayload } from 'jsonwebtoken';

export interface DecodedAccessToken extends JwtPayload {
	user: {
		id: string;
		email: string;
		roleId: string;
		roleName: string;
		extraPermissions: string[];
	};
}

export interface DecodedRefreshToken extends JwtPayload {
	id: string;
}
