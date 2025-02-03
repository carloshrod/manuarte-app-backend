import { Router } from 'express';
import { StockItemService } from './service';
import { StockItemModel } from './model';
import { StockItemController } from './controller';

const router = Router();

const stockItemService = new StockItemService(StockItemModel);

const stockItemController = new StockItemController(stockItemService);

router.get('/', stockItemController.getAll);
router.post('/', stockItemController.create);
router.put('/:id', stockItemController.update);
router.delete('/:id', stockItemController.delete);

export default router;
