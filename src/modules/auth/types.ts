import { JwtPayload } from 'jsonwebtoken';

export interface DecodedAccessToken extends JwtPayload {
	user: {
		id: string;
		email: string;
		roleId: string;
		roleName: string;
		shop: string;
		shopId: string;
		stockId: string;
		isoCode: string;
		mainStock: boolean;
		extraPermissions: string[];
	};
}

export interface DecodedRefreshToken extends JwtPayload {
	id: string;
}
