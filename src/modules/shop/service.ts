import { ShopModel } from './model';

export class ShopService {
	private shopModel;

	constructor(shopModel: typeof ShopModel) {
		this.shopModel = shopModel;
	}

	getAll = async () => {
		try {
			const shops = await this.shopModel.findAll({
				attributes: ['id', 'name', 'slug'],
			});
			if (shops.length === 0) {
				return { status: 204 };
			}

			return { status: 200, shops };
		} catch (error) {
			console.error('Error obteniendo tiendas');
			throw error;
		}
	};
}
