import { Router } from 'express';
import { TransactionService } from './service';
import { TransactionModel } from './model';
import { TransactionController } from './controller';

const router = Router();

const transactionService = new TransactionService(TransactionModel);

const transactionController = new TransactionController(transactionService);

router.get('/', transactionController.getAll);
router.get('/items/:id', transactionController.getItems);
router.post('/', transactionController.create);

export default router;
