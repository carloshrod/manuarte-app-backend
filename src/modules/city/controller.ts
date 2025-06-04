import { Handler } from 'express';
import { CityService } from './service';

export class CityController {
	private cityService;

	constructor(cityService: CityService) {
		this.cityService = cityService;
	}

	search: Handler = async (req, res, next) => {
		try {
			try {
				const search = (req.query.search as string) || '';
				const result = await this.cityService.search(search);

				if (result.status === 200) {
					res.status(result.status).json(result.cities);
					return;
				}

				res.sendStatus(500);
			} catch (error) {
				next(error);
			}
		} catch (error) {
			next(error);
		}
	};
}
