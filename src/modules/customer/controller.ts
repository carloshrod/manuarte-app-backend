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

			if (customers.length > 0) {
				res.status(200).json(customers);
			} else {
				res.sendStatus(204);
			}
		} catch (error) {
			next(error);
		}
	};

	create: Handler = async (req, res, next) => {
		try {
			const result = await this.customerService.create(req.body);
			if (result.status !== 201) {
				res.sendStatus(500);
				return;
			}

			res.status(result.status).json({
				newCustomer: result.customer,
				message: 'Cliente registrado con éxito',
			});
		} catch (error) {
			next(error);
		}
	};

	update: Handler = async (req, res, next) => {
		try {
			const { personId } = req.params;
			const result = await this.customerService.update({
				...req.body,
				personId,
			});
			if (result.status !== 200) {
				res.sendStatus(500);
				return;
			}

			res.status(result.status).json({
				updatedCustomer: result.updatedCustomer,
				message: 'Cliente actualizado con éxito',
			});
		} catch (error) {
			next(error);
		}
	};

	delete: Handler = async (req, res, next) => {
		try {
			const { personId } = req.params;
			const result = await this.customerService.delete(personId);

			res.status(result.status).json({ message: result.message });
		} catch (error) {
			next(error);
		}
	};

	searchCustomer: Handler = async (req, res, next) => {
		try {
			const search = (req.query.search as string) || '';
			const result = await this.customerService.searchCustomer(search);

			res.status(result.status).json(result.customer);
		} catch (error) {
			next(error);
		}
	};
}
