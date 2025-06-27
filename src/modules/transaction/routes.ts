import { Router } from 'express';
import { TransactionService } from './service';
import { TransactionModel } from './model';
import { TransactionController } from './controller';
import { authorize } from '../../middlewares/authorize';
import { TransactionPermissions } from '../permission/enums';

const router = Router();

const transactionService = new TransactionService(TransactionModel);

const transactionController = new TransactionController(transactionService);

router.get(
	'/',
	authorize(TransactionPermissions.TRANSACTION_READ),
	transactionController.getAll,
);
router.get(
	'/items/:id',
	authorize(TransactionPermissions.TRANSACTION_READ),
	transactionController.getItems,
);
router.get(
	'/items-in-transit/:stockId',
	authorize(TransactionPermissions.TRANSACTION_READ),
	transactionController.getItemsInTransit,
);
router.post(
	'/',
	authorize(TransactionPermissions.TRANSACTION_CREATE),
	transactionController.create,
);
router.put(
	'/transfer/:id',
	authorize(TransactionPermissions.TRANSACTION_UPDATE),
	transactionController.updateTransfer,
);

export default router;
