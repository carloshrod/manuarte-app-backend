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
const productVariantService = new ProductVariantService({
	productVariantModel: ProductVariantModel,
	productCategoryService,
});
const productService = new ProductService(ProductModel, productVariantService);

const productController = new ProductController(productService);

router.get('/', productController.getAll);
router.post('/', productController.create);

export default router;
