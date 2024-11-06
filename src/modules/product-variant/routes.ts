import { Router } from 'express';
import { ProductVariantController } from './controller';
import { ProductVariantService } from './service';
import { ProductVariantModel } from './model';
import { ProductCategoryService } from '../product-category/service';
import { ProductCategoryModel } from '../product-category/model';

const router = Router();

const productCategoryService = new ProductCategoryService(ProductCategoryModel);
const productVariantService = new ProductVariantService({
	productVariantModel: ProductVariantModel,
	productCategoryService,
});

const productVariantController = new ProductVariantController(
	productVariantService,
);

router.get('/', productVariantController.getAll);

export default router;
