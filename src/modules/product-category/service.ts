import { ProductCategoryModel } from './model';

export class ProductCategoryService {
	private productCategoryModel;

	constructor() {
		this.productCategoryModel = ProductCategoryModel;
	}

	getAll = async () => {
		try {
			const categories = await this.productCategoryModel.findAll();

			return categories;
		} catch (error) {
			console.error(error);
		}
	};
}
