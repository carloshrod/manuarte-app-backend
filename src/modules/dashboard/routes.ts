import { Router } from 'express';
import { DashboardController } from './controller';
import { authorize } from '../../middlewares/authorize';
import { BillingPermissions, DashboardPermissions } from '../permission/enums';

const router = Router();

const dashboardController = new DashboardController();

router.get(
	'/stats',
	authorize(DashboardPermissions.DASHBOARD_READ),
	dashboardController.getStats,
);

router.get(
	'/top-sales',
	authorize(DashboardPermissions.DASHBOARD_READ),
	dashboardController.getTopSales,
);

router.get(
	'/sales-report',
	authorize(BillingPermissions.BILLING_READ),
	dashboardController.getTopSalesReport,
);

export default router;
