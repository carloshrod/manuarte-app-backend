import { Router } from 'express';
import { ShopService } from './service';
import { ShopModel } from './model';
import { ShopController } from './controller';

const router = Router();

const shopService = new ShopService(ShopModel);

const shopController = new ShopController(shopService);

router.get('/', shopController.getAll);

export default router;
