interface Product {
	id: string;
	name: string;
	description: string;
	pId: string;
	createdBy: string;
	updatedBy: string;
	createdDate: string;
	updatedDate: string;
	deletedDate?: string;
	variantProductVId: string;
	variantProductName: string;
	categoryProductId: string;
	categoryProductName: string;
	qrCode: string;
}
