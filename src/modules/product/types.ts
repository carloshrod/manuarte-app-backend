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

export type ProductCreationAttr = Pick<
	ProductAttr,
	'name' | 'description' | 'categoryProductId'
>;

export interface ProductCreateService {
	productData: ProductCreationAttr;
	productVariants: string[];
	submittedBy: string;
}
