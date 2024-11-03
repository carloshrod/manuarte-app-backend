import { sequelize } from '../../config/database';
import { ProductModel } from './model';
import { ProductCategoryModel } from '../product-category/model';
import { ProductVariantModel } from '../product-variant/model';
import QRCode from 'qrcode';

export class ProductService {
	private productModel;

	constructor() {
		this.productModel = ProductModel;
	}

	getAll = async () => {
		const products = await this.productModel.findAll({
			attributes: {
				include: [
					[sequelize.col('variantProduct.vId'), 'variantProductVId'],
					[sequelize.col('variantProduct.name'), 'variantProductName'],
					[sequelize.col('categoryProduct.name'), 'categoryProductName'],
				],
			},
			include: [
				{
					model: ProductCategoryModel,
					as: 'categoryProduct',
					attributes: [],
				},
				{
					model: ProductVariantModel,
					as: 'variantProduct',
					attributes: [],
				},
			],
			order: [['name', 'ASC']],
		});

		const productsWithQR = await Promise.all(
			products.map(async product => {
				const variantProductVId =
					(product.get('variantProductVId') as string) ?? 'NO vID';

				const qrCodeData = await QRCode.toDataURL(variantProductVId);

				return { ...product.get(), qrCode: qrCodeData };
			}),
		);

		return productsWithQR;
	};
}
