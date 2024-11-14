import { Router } from 'express';
import { ProductCategoryController } from './controller';
import { ProductCategoryService } from './service';
import { ProductCategoryModel } from './model';

const router = Router();

const productCategoryService = new ProductCategoryService(ProductCategoryModel);

const productCategoryController = new ProductCategoryController(
	productCategoryService,
);

router.post('/', productCategoryController.create);
router.get('/', productCategoryController.getAll);
router.put('/:id', productCategoryController.update);
router.delete('/:id', productCategoryController.delete);

export default router;
