import { Router } from 'express';
import { ProductVariantController } from './controller';
import { ProductVariantService } from './service';
import { ProductVariantModel } from './model';
import { ProductCategoryService } from '../product-category/service';

const router = Router();

const productCategoryService = new ProductCategoryService();
const productVariantService = new ProductVariantService({
	productVariantModel: ProductVariantModel,
	productCategoryService,
});

const productVariantController = new ProductVariantController(
	productVariantService,
);

router.get('/', productVariantController.getAll);

export default router;
