import { CustomerController } from './controller';
import { Router } from 'express';
import { CustomerService } from './service';
import { CustomerModel } from './model';

const router = Router();

const customerService = new CustomerService(CustomerModel);

const customerController = new CustomerController(customerService);

router.get('/', customerController.getAll);

export default router;
