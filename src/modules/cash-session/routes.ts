import { Router } from 'express';
import { CashSessionService } from './service';
import { CashSessionModel } from './model';
import { CashSessionController } from './controller';
import { authorize } from '../../middlewares/authorize';
import {
	BankTransferPermissions,
	CashSessionPermissions,
} from '../permission/enums';
import { CashMovementService } from '../cash-movement/service';
import { CashMovementModel } from '../cash-movement/model';
import { CashMovementController } from '../cash-movement/controller';
import { BankTransferMovementService } from '../bank-transfer-movement/service';
import { BankTransferMovementModel } from '../bank-transfer-movement/model';
import { BankTransferMovementController } from '../bank-transfer-movement/controller';
import { PiggyBankMovementService } from '../piggy-bank/service';
import { PiggyBankMovementModel } from '../piggy-bank/model';
import { PiggyBankMovementController } from '../piggy-bank/controller';

const router = Router();

const cashSessionService = new CashSessionService(CashSessionModel);
const cashMovementService = new CashMovementService(CashMovementModel);
const piggyBankMovementService = new PiggyBankMovementService(
	PiggyBankMovementModel,
);
const bankTransferMovementService = new BankTransferMovementService(
	BankTransferMovementModel,
);

const cashSessionController = new CashSessionController(cashSessionService);
const cashMovementController = new CashMovementController(cashMovementService);
const piggyBankMovementController = new PiggyBankMovementController(
	piggyBankMovementService,
);
const bankTransferMovementController = new BankTransferMovementController(
	bankTransferMovementService,
);

router.get(
	'/:shopId/current',
	authorize(CashSessionPermissions.CASH_SESSION_READ),
	cashSessionController.getCurrentSession,
);

router.get(
	'/:shopId',
	authorize(CashSessionPermissions.CASH_SESSION_READ),
	cashSessionController.getSessionByDate,
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

router.post(
	'/:shopId/piggy-bank-withdraw',
	authorize(CashSessionPermissions.CASH_SESSION_MOVEMENTS_CREATE),
	piggyBankMovementController.withDraw,
);

router.get(
	'/:shopId/bank-movements',
	authorize(BankTransferPermissions.BANK_TRANSFER_MOVEMENTS_READ),
	bankTransferMovementController.getAllByShopId,
);

export default router;
