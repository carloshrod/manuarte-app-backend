import { Router } from 'express';
import { DashboardController } from './controller';

const router = Router();

const dashboardController = new DashboardController();

router.get('/stats', dashboardController.getStats);
router.get('/monthly-sales', dashboardController.getMonthlySales);
router.get('/top-sales/:month', dashboardController.getTopSalesProducts);

export default router;
