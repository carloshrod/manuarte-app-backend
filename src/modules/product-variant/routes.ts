import { Router } from 'express';
import { ProductVariantController } from './controller';
import { ProductVariantService } from './service';
import { ProductVariantModel } from './model';
import { authorize } from '../../middlewares/authorize';
import { ProductPermissions } from '../permission/enums';

const router = Router();

const productVariantService = new ProductVariantService(ProductVariantModel);

const productVariantController = new ProductVariantController(
	productVariantService,
);

router.get(
	'/',
	authorize(ProductPermissions.PRODUCT_READ),
	productVariantController.getAll,
);
router.get(
	'/stock-info/:id',
	authorize(ProductPermissions.PRODUCT_READ),
	productVariantController.getProductVariantStockInfo,
);
router.put(
	'/:id',
	authorize(ProductPermissions.PRODUCT_UPDATE),
	productVariantController.update,
);

export default router;
