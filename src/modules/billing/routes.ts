import { Router } from 'express';
import { BillingService } from './service';
import { BillingModel } from './model';
import { BillingController } from './controller';

const router = Router();

const billingService = new BillingService(BillingModel);

const billingController = new BillingController(billingService);

router.get('/', billingController.getAll);
router.get('/:serialNumber', billingController.getOne);
router.post('/', billingController.create);
router.put('/:id', billingController.update);
router.delete('/cancel/:serialNumber', billingController.cancel);
router.delete('/:id', billingController.delete);

export default router;
