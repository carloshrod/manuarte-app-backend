export interface ProductAttr {
	id?: string;
	name: string;
	description: string;
	pId?: string;
	productCategoryId: string;
	createdBy: string;
	updatedBy: string;
	createdDate?: Date;
	updatedDate?: Date;
	deletedDate?: Date | null;
}

export interface CreateProductDto {
	productData: Partial<ProductAttr>;
	productVariants: string[];
	requestedBy: string;
}

export interface UpdateProductDto {
	id: string;
	productData: Partial<ProductAttr>;
	productVariantData: {
		id: string;
		name: string;
	};
	requestedBy: string;
}

export interface AddProductVariantDto {
	productId: string;
	name: string;
	requestedBy: string;
}
