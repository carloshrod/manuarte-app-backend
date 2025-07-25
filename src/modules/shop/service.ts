import { sequelize } from '../../config/database';
import { CountryModel } from '../country/model';
import { StockModel } from '../stock/model';
import { ShopModel } from './model';

export class ShopService {
	private shopModel;

	constructor(shopModel: typeof ShopModel) {
		this.shopModel = shopModel;
	}

	getAll = async () => {
		try {
			const shops = await this.shopModel.findAll({
				attributes: [
					'id',
					'name',
					'slug',
					'currency',
					[sequelize.col('stock.id'), 'stockId'],
					[sequelize.col('stock.name'), 'stockName'],
					[sequelize.col('stock.isMain'), 'mainStock'],
					[sequelize.col('country.isoCode'), 'isoCode'],
				],
				include: [
					{
						model: StockModel,
						as: 'stock',
						attributes: [],
					},
					{
						model: CountryModel,
						as: 'country',
						attributes: [],
					},
				],
				order: [['name', 'ASC']],
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

	getOneBySlug = async (shopSlug: string) => {
		try {
			const shop = await this.shopModel.findOne({
				where: { slug: shopSlug },
				attributes: [
					'id',
					'currency',
					[sequelize.col('stock.id'), 'stockId'],
					[sequelize.col('stock.isMain'), 'mainStock'],
				],
				include: [
					{
						model: StockModel,
						as: 'stock',
						attributes: [],
					},
				],
			});

			return shop;
		} catch (error) {
			console.error('Error obteniendo tienda');
			throw error;
		}
	};
}
