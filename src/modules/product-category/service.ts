import { ProductCategoryModel } from './model';

export class ProductCategoryService {
	private productCategoryModel;

	constructor(productCategoryModel: typeof ProductCategoryModel) {
		this.productCategoryModel = productCategoryModel;
	}

	getAll = async () => {
		try {
			const categories = await this.productCategoryModel.findAll();

			return categories;
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	getName = async (categoryProductId: string) => {
		try {
			const category = await this.productCategoryModel.findByPk(
				categoryProductId,
				{ attributes: ['name'] },
			);

			if (!category) throw new Error('Categoría no encontrada');

			return category.name;
		} catch (error) {
			console.error('Error obteniendo nombre de la categoría: ', error);
			throw error;
		}
	};
}
