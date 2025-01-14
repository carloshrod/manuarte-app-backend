import { Router } from 'express';
import { QuoteModel } from './model';
import { QuoteService } from './service';
import { QuoteController } from './controller';

const router = Router();

const quoteService = new QuoteService(QuoteModel);

const quoteController = new QuoteController(quoteService);

router.get('/', quoteController.getAll);
router.get('/:serialNumber', quoteController.getOne);
router.post('/', quoteController.create);
router.put('/:id', quoteController.update);
router.delete('/:id', quoteController.delete);

export default router;
