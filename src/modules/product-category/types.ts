export interface ProductCategoryAttr {
	id?: string;
	name: string;
	cId?: string;
	createdBy: string;
	updatedBy: string;
	createdDate?: Date;
	updatedDate?: Date;
	deletedDate?: Date | null;
}

export interface CreateProductCategoryService {
	name: string;
	submittedBy: string;
}

export interface UpdateProductCategoryService
	extends CreateProductCategoryService {
	id: string;
}
