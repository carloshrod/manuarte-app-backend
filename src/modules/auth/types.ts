import { JwtPayload } from 'jsonwebtoken';

export interface DecodedToken extends JwtPayload {
	UserInfo: {
		id: string;
		email: string;
		roles?: string[];
	};
}
