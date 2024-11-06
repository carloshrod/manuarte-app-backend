import sequelize from 'sequelize';
import { ProductCategoryModel } from '../product-category/model';
import { ProductModel } from '../product/model';
import QRCode from 'qrcode';
import { CustomCreateOptions } from '../types';
import {
	ProductVariantConstructor,
	ProductVariantCreateService,
} from './types';

export class ProductVariantService {
	private productVariantModel;
	private productCategoryService;

	constructor({
		productVariantModel,
		productCategoryService = undefined,
	}: ProductVariantConstructor) {
		this.productVariantModel = productVariantModel;
		this.productCategoryService = productCategoryService;
	}

	getAll = async () => {
		try {
			const productVariants = await this.productVariantModel.findAll({
				attributes: {
					include: [
						[sequelize.col('product.name'), 'productName'],
						[sequelize.col('product.description'), 'productDescription'],
						[
							sequelize.col('product.categoryProduct.name'),
							'categoryProductName',
						],
					],
				},
				include: [
					{
						model: ProductModel,
						as: 'product',
						attributes: [],
						include: [
							{
								model: ProductCategoryModel,
								as: 'categoryProduct',
								attributes: [],
							},
						],
					},
				],
				order: [['productName', 'ASC']],
			});

			const productVariantsWithQR = await Promise.all(
				productVariants.map(async productVariant => {
					const variantProductVId = productVariant.vId ?? 'NO vID';

					const qrCodeData = await QRCode.toDataURL(variantProductVId);

					return { ...productVariant.dataValues, qrCode: qrCodeData };
				}),
			);

			return productVariantsWithQR;
		} catch (error) {
			console.error(error);
			throw error;
		}
	};

	create = async ({
		productVariantName,
		productData,
		submittedBy,
	}: ProductVariantCreateService) => {
		try {
			const productVariantData = {
				name: productVariantName,
				productId: productData.id,
			};

			const newProductVariant = await this.productVariantModel.create(
				productVariantData,
				{ submittedBy } as CustomCreateOptions,
			);

			const categoryName = await this.productCategoryService?.getName(
				productData.categoryProductId,
			);

			const qrCodeData = await QRCode.toDataURL(newProductVariant.vId);

			return {
				...newProductVariant.dataValues,
				productName: productData?.name,
				productDescription: productData?.description,
				categoryProductName: categoryName,
				qrCode: qrCodeData,
			};
		} catch (error) {
			console.error('Error creando presentación de producto: ', error);
			throw error;
		}
	};
}
