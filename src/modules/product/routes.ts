import { Router } from 'express';
import { ProductController } from './controller';
import { ProductService } from './service';
import { ProductCategoryService } from './../product-category/service';
import { ProductVariantService } from '../product-variant/service';
import { ProductModel } from './model';
import { ProductVariantModel } from '../product-variant/model';
import { ProductCategoryModel } from '../product-category/model';

const router = Router();

const productCategoryService = new ProductCategoryService(ProductCategoryModel);
const productVariantService = new ProductVariantService(ProductVariantModel);
const productService = new ProductService({
	productModel: ProductModel,
	productVariantService,
	productCategoryService,
});

const productController = new ProductController(productService);

router.get('/', productController.getAll);
router.post('/', productController.create);
router.put('/:id', productController.update);

export default router;
