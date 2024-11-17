import { Router } from 'express';
import { ProductController } from './controller';
import { ProductService } from './service';
import { ProductModel } from './model';

const router = Router();

const productService = new ProductService(ProductModel);

const productController = new ProductController(productService);

router.get('/', productController.getAll);
router.post('/', productController.create);
router.post('/add-variant/:id', productController.addVariant);
router.put('/:id', productController.update);
router.delete('/', productController.delete);

export default router;
