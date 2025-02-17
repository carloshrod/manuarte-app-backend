import { Router } from 'express';
import { StockItemService } from './service';
import { StockItemModel } from './model';
import { StockItemController } from './controller';
import { authorize } from '../../middlewares/authorize';
import { StockItemPermissions } from '../permission/enums';

const router = Router();

const stockItemService = new StockItemService(StockItemModel);

const stockItemController = new StockItemController(stockItemService);

router.get(
	'/',
	authorize(StockItemPermissions.STOCK_ITEM_READ),
	stockItemController.getAll,
);
router.post(
	'/',
	authorize(StockItemPermissions.STOCK_ITEM_CREATE),
	stockItemController.create,
);
router.put(
	'/:id',
	authorize(StockItemPermissions.STOCK_ITEM_UPDATE),
	stockItemController.update,
);
router.delete(
	'/:id',
	authorize(StockItemPermissions.STOCK_ITEM_DELETE),
	stockItemController.delete,
);

export default router;
