import { JwtPayload } from 'jsonwebtoken';

export interface DecodedAccessToken extends JwtPayload {
	UserInfo: {
		id: string;
		email: string;
		role: string;
	};
}

export interface DecodedRefreshToken extends JwtPayload {
	id: string;
}
