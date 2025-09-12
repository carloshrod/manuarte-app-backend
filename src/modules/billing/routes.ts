import { Router } from 'express';
import { BillingService } from './service';
import { BillingModel } from './model';
import { BillingController } from './controller';
import { authorize } from '../../middlewares/authorize';
import { BillingPermissions } from '../permission/enums';

const router = Router();

const billingService = new BillingService(BillingModel);

const billingController = new BillingController(billingService);

router.get(
	'/',
	authorize(BillingPermissions.BILLING_READ),
	billingController.getAll,
);
router.get(
	'/:serialNumber',
	authorize(BillingPermissions.BILLING_READ),
	billingController.getOne,
);
router.post(
	'/',
	authorize(BillingPermissions.BILLING_CREATE),
	billingController.create,
);
router.put(
	'/:id',
	authorize(BillingPermissions.BILLING_UPDATE),
	billingController.update,
);
router.delete(
	'/cancel/:serialNumber',
	authorize(BillingPermissions.BILLING_DELETE),
	billingController.cancel,
);

export default router;
