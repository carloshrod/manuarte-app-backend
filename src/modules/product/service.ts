import { sequelize } from '../../config/database';
import { ProductModel } from './model';
import { ProductCategoryModel } from '../product-category/model';
import { ProductVariantService } from '../product-variant/service';
import { ProductVariantModel } from '../product-variant/model';
import {
	AddProductVariantDto,
	CreateProductDto,
	UpdateProductDto,
} from './types';

export class ProductService {
	private productModel;
	private productCategoryModel;
	private productVariantService;

	constructor(productModel: typeof ProductModel) {
		this.productModel = productModel;
		this.productCategoryModel = ProductCategoryModel;
		this.productVariantService = new ProductVariantService(ProductVariantModel);
	}

	getAll = async () => {
		try {
			const products = await this.productModel.findAll({
				attributes: ['id', 'name'],
				order: [['name', 'ASC']],
			});

			return products;
		} catch (error) {
			console.error('ServiceError obteniendo productos: ', error);
			throw error;
		}
	};

	create = async ({
		productData,
		productVariants,
		requestedBy,
	}: CreateProductDto) => {
		try {
			const newProduct = this.productModel.build({
				...productData,
				name: productData.name?.trim(),
				createdBy: requestedBy,
				updatedBy: requestedBy,
			});

			await newProduct.generatePId();
			await newProduct.save();

			const newProductVariants = [];
			if (productVariants?.length > 0) {
				for (const name of productVariants) {
					const newProductVariant = await this.productVariantService.create({
						name,
						productId: newProduct.id,
						requestedBy,
					});

					newProductVariants.push(newProductVariant);
				}
			}

			const categoryName = await this.getCategoryName(
				newProduct?.categoryProductId,
			);

			return {
				...newProduct.dataValues,
				categoryProductName: categoryName,
				productVariants: newProductVariants,
			};
		} catch (error) {
			console.error('ServiceError creando producto: ', error);
			throw error;
		}
	};

	update = async ({
		id,
		productData,
		productVariantData,
		requestedBy,
	}: UpdateProductDto) => {
		try {
			const productToUpdate = await this.productModel.findByPk(id);
			if (!productToUpdate)
				throw new Error(`No fue posible encontrar el producto`);

			await productToUpdate.update({
				...productData,
				name: productData.name?.trim(),
				updatedBy: requestedBy,
				updatedDate: sequelize.fn('now'),
			});

			const updatedProductVariant = await this.productVariantService.update({
				id: productVariantData.id,
				name: productVariantData.name,
				requestedBy,
			});

			const categoryName = await this.getCategoryName(
				productToUpdate?.categoryProductId,
			);

			return {
				...productToUpdate.dataValues,
				categoryProductName: categoryName,
				productVariant: updatedProductVariant,
			};
		} catch (error) {
			console.error('ServiceError actualizando producto: ', error);
			throw error;
		}
	};

	addVariant = async ({
		productId,
		name,
		requestedBy,
	}: AddProductVariantDto) => {
		try {
			const productVariantToUpdate = await this.productVariantService.create({
				name,
				productId,
				requestedBy,
			});

			const product = await this.productModel.findByPk(productId);
			let categoryProductName;
			if (product) {
				categoryProductName = await this.getCategoryName(
					product?.categoryProductId,
				);
			}

			return {
				...productVariantToUpdate,
				productId,
				productName: product?.name,
				productDescription: product?.description,
				categoryProductId: product?.categoryProductId,
				categoryProductName,
			};
		} catch (error) {
			console.error('ServiceError agregando presentación de producto: ', error);
			throw error;
		}
	};

	delete = async (productId: string, productVariantId: string) => {
		try {
			const productVariantDeleted =
				await this.productVariantService.delete(productVariantId);

			const count = await this.productVariantService.count(productId);

			let productDeleted = 0;
			if (count === 0) {
				productDeleted = await this.productModel.destroy({
					where: { id: productId },
				});

				return { productVariantDeleted, productDeleted };
			}

			return { productVariantDeleted, productDeleted };
		} catch (error) {
			console.error('ServiceError eliminando producto: ', error);
			throw error;
		}
	};

	count = async (categoryProductId: string) => {
		try {
			const productsCount = await this.productModel.count({
				where: { categoryProductId },
			});

			return productsCount;
		} catch (error) {
			console.error('ServiceError en el conteo de productos: ', error);
			throw error;
		}
	};

	getCategoryName = async (id: string) => {
		try {
			const category = await this.productCategoryModel.findByPk(id, {
				attributes: ['name'],
			});

			if (!category) throw new Error('Categoría no encontrada');

			return category.name;
		} catch (error) {
			console.error(
				'ServiceError obteniendo nombre de la categoría de producto: ',
				error,
			);
			throw new Error('Error interno del servidor');
		}
	};
}
