import { ProductCategoryService } from '../product-category/service';
import { ProductData } from '../product/types';
import { ProductVariantModel } from './model';

export interface ProductVariantAttr {
	id?: string;
	name: string;
	quantity: number;
	productId: string;
	vId?: string;
	createdBy: string;
	updatedBy: string;
	createdDate?: Date;
	updatedDate?: Date;
	deletedDate?: Date | null;
}

export type ProductVariantServiceConstructor = typeof ProductVariantModel;
