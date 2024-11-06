import { Router } from 'express';
import { ProductCategoryController } from './controller';
import { ProductCategoryService } from './service';
import { ProductCategoryModel } from './model';

const router = Router();

const productCategoryService = new ProductCategoryService(ProductCategoryModel);

const productCategoryController = new ProductCategoryController(
	productCategoryService,
);

router.get('/', productCategoryController.getAll);

export default router;
