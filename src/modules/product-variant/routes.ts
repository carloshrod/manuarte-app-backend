import { Router } from 'express';
import { ProductVariantController } from './controller';
import { ProductVariantService } from './service';
import { ProductVariantModel } from './model';

const router = Router();

const productVariantService = new ProductVariantService(ProductVariantModel);

const productVariantController = new ProductVariantController(
	productVariantService,
);

router.get('/', productVariantController.getAll);

export default router;
