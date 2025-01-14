import { CustomerController } from './controller';
import { Router } from 'express';
import { CustomerService } from './service';
import { CustomerModel } from './model';
import { authorize } from '../../middlewares/authorize';
import { CustomerPermissions } from '../permission/enums';

const router = Router();

const customerService = new CustomerService(CustomerModel);

const customerController = new CustomerController(customerService);

router.get(
	'/',
	authorize(CustomerPermissions.CUSTOMER_READ),
	customerController.getAll,
);
router.get(
	'/search',
	authorize(CustomerPermissions.CUSTOMER_READ),
	customerController.searchCustomer,
);
router.post(
	'/',
	authorize(CustomerPermissions.CUSTOMER_CREATE),
	customerController.create,
);
router.put(
	'/:personId',
	authorize(CustomerPermissions.CUSTOMER_UPDATE),
	customerController.update,
);
router.delete(
	'/:personId',
	authorize(CustomerPermissions.CUSTOMER_DELETE),
	customerController.delete,
);

export default router;
