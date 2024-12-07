import { Handler } from 'express';
import { UserService } from './service';

export class UserController {
	private userService;

	constructor(userService: UserService) {
		this.userService = userService;
	}

	getAll: Handler = async (_req, res, next) => {
		try {
			const users = await this.userService.getAll();

			if (users.length > 0) {
				res.status(200).json(users);
			} else {
				res.sendStatus(204);
			}
		} catch (error) {
			next(error);
		}
	};
}
