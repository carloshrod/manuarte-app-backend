import { Router } from 'express';
import { BillingService } from './service';
import { BillingModel } from './model';
import { BillingController } from './controller';

const router = Router();

const billingService = new BillingService(BillingModel);

const billingController = new BillingController(billingService);

export default router;
