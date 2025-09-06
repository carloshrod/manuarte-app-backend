import { Router } from 'express';
import { CashSessionService } from './service';
import { CashSessionModel } from './model';
import { CashSessionController } from './controller';
import { authorize } from '../../middlewares/authorize';
import { CashSessionPermissions } from '../permission/enums';
import { CashMovementService } from '../cash-movement/service';
import { CashMovementModel } from '../cash-movement/model';
import { CashMovementController } from '../cash-movement/controller';

const router = Router();

const cashSessionService = new CashSessionService(CashSessionModel);
const cashMovementService = new CashMovementService(CashMovementModel);

const cashSessionController = new CashSessionController(cashSessionService);
const cashMovementController = new CashMovementController(cashMovementService);

router.get(
	'/:shopId',
	authorize(CashSessionPermissions.CASH_SESSION_READ),
	cashSessionController.getLastSessionByShopId,
);

router.post(
	'/:shopId/open',
	authorize(CashSessionPermissions.CASH_SESSION_CREATE),
	cashSessionController.openSession,
);

router.post(
	'/:shopId/close',
	authorize(CashSessionPermissions.CASH_SESSION_CLOSE),
	cashSessionController.closeSession,
);

router.post(
	'/:shopId/movements',
	authorize(CashSessionPermissions.CASH_SESSION_MOVEMENTS_CREATE),
	cashMovementController.createMovement,
);

export default router;
