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

export interface CreateProductCategoryDto {
	name: string;
	requestedBy: string;
}

export interface UpdateProductCategoryDto extends CreateProductCategoryDto {
	id: string;
}
