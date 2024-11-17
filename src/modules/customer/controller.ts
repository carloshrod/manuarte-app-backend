import { Handler } from 'express';
import { CustomerService } from './service';

export class CustomerController {
	private customerService;

	constructor(customerService: CustomerService) {
		this.customerService = customerService;
	}

	getAll: Handler = async (_req, res, next) => {
		try {
			const customers = await this.customerService.getAll();

			res.status(200).json(customers);
		} catch (error) {
			next(error);
		}
	};
}
