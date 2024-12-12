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

export interface CreateProductVariantDto {
	name: string;
	productId: string;
	requestedBy: string;
}

export interface UpdateProductVariantDto {
	id: string;
	name: string;
	requestedBy: string;
}
