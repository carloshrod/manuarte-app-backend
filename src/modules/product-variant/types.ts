import { ProductCategoryService } from '../product-category/service';
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

export interface ProductVariantCreateService {
	productVariantName: string;
	productData: {
		id: string;
		name: string;
		description: string;
		categoryProductId: string;
	};
	submittedBy: string;
}

export interface ProductVariantConstructor {
	productVariantModel: typeof ProductVariantModel;
	productCategoryService: ProductCategoryService;
}
