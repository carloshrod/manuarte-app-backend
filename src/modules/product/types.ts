import { ProductCategoryService } from '../product-category/service';
import { ProductVariantService } from '../product-variant/service';
import { ProductModel } from './model';

export interface ProductAttr {
	id?: string;
	name: string;
	description: string;
	pId?: string;
	categoryProductId: string;
	createdBy: string;
	updatedBy: string;
	createdDate?: Date;
	updatedDate?: Date;
	deletedDate?: Date | null;
}

export interface ProductData {
	id: string;
	name: string;
	description: string;
	categoryProductId: string;
}

export interface ProductCreateService {
	productData: Partial<ProductAttr>;
	productVariants: string[];
	submittedBy: string;
}

export interface ProductUpdateService {
	id: string;
	productData: Partial<ProductAttr>;
	productVariantData: {
		id: string;
		name: string;
	};
	submittedBy: string;
}

export interface ProductServiceConstructor {
	productModel: typeof ProductModel;
	productVariantService: ProductVariantService;
	productCategoryService: ProductCategoryService;
}
