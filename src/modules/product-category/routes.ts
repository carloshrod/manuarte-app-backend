import { Router } from 'express';
import { ProductCategoryController } from './controller';

const router = Router();
const productCategoryController = new ProductCategoryController();

router.get('/', productCategoryController.getAll);

export default router;
