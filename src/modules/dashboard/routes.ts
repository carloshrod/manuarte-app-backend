import { Router } from 'express';
import { DashboardController } from './controller';

const router = Router();

const dashboardController = new DashboardController();

router.get('/stats', dashboardController.getStats);

export default router;
