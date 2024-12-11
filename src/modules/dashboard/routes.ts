import { Router } from 'express';
import { DashboardController } from './controller';
import { authorize } from '../../middlewares/authorize';
import { DashboardPermissions } from '../permission/enums';

const router = Router();

const dashboardController = new DashboardController();

router.get(
	'/stats',
	authorize(DashboardPermissions.DASHBOARD_READ),
	dashboardController.getStats,
);

export default router;
