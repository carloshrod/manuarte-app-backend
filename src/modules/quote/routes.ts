import { Router } from 'express';
import { QuoteModel } from './model';
import { QuoteService } from './service';
import { QuoteController } from './controller';
import { authorize } from '../../middlewares/authorize';
import { QuotePermissions } from '../permission/enums';

const router = Router();

const quoteService = new QuoteService(QuoteModel);

const quoteController = new QuoteController(quoteService);

router.get('/', authorize(QuotePermissions.QUOTE_READ), quoteController.getAll);
router.get(
	'/:serialNumber',
	authorize(QuotePermissions.QUOTE_READ),
	quoteController.getOne,
);
router.post(
	'/',
	authorize(QuotePermissions.QUOTE_CREATE),
	quoteController.create,
);
router.put(
	'/:id',
	authorize(QuotePermissions.QUOTE_UPDATE),
	quoteController.update,
);
router.delete(
	'/:id',
	authorize(QuotePermissions.QUOTE_DELETE),
	quoteController.delete,
);

export default router;
