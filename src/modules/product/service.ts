import {
	AddProductVariantService,
	CreateProductService,
	ProductServiceConstructor,
	UpdateProductService,
} from './types';
import { sequelize } from '../../config/database';
import { Op } from 'sequelize';

export class ProductService {
	private productModel;
	private productVariantService;
	private productCategoryService;

	constructor({
		productModel,
		productVariantService,
		productCategoryService,
	}: ProductServiceConstructor) {
		this.productModel = productModel;
		this.productVariantService = productVariantService;
		this.productCategoryService = productCategoryService;
	}

	create = async ({
		productData,
		productVariants,
		submittedBy,
	}: CreateProductService) => {
		try {
			const newProduct = this.productModel.build({
				...productData,
				createdBy: submittedBy,
				updatedBy: submittedBy,
			});

			await newProduct.generatePId();
			await newProduct.save();

			const newProductVariants = [];
			if (productVariants?.length > 0) {
				for (const name of productVariants) {
					const newProductVariant = await this.productVariantService.create(
						{
							name,
							productId: newProduct.id,
						},
						submittedBy,
					);

					newProductVariants.push(newProductVariant);
				}
			}

			const categoryName = await this.productCategoryService.getName(
				newProduct?.categoryProductId,
			);

			return {
				...newProduct.dataValues,
				categoryProductName: categoryName,
				productVariants: newProductVariants,
			};
		} catch (error) {
			console.error('Error creando producto: ', error);
			throw error;
		}
	};

	getAll = async () => {
		try {
			const products = await this.productModel.findAll({
				attributes: ['id', 'name'],
				order: [['name', 'ASC']],
			});

			return products;
		} catch (error) {
			console.error('Error obteniendo productos: ', error);
			throw error;
		}
	};

	getProductsByName = async (productName: string) => {
		try {
			const products = await this.productModel.findAll({
				where: { name: { [Op.iLike]: `%${productName}%` } },
			});

			return products;
		} catch (error) {
			console.error('Error obteniendo productos por nombre: ', error);
			throw error;
		}
	};

	update = async ({
		id,
		productData,
		productVariantData,
		submittedBy,
	}: UpdateProductService) => {
		try {
			const productToUpdate = await this.productModel.findByPk(id);
			if (!productToUpdate)
				throw new Error(`No se encontró el producto con id ${id}`);

			await productToUpdate.update({
				...productData,
				updatedBy: submittedBy,
				updatedDate: sequelize.fn('now'),
			});

			const updatedProductVariant = await this.productVariantService.update({
				id: productVariantData.id,
				name: productVariantData.name,
				submittedBy,
			});

			const categoryName = await this.productCategoryService.getName(
				productToUpdate?.categoryProductId,
			);

			return {
				...productToUpdate.dataValues,
				categoryProductName: categoryName,
				productVariant: updatedProductVariant,
			};
		} catch (error) {
			console.error('Error actualizando producto: ', error);
			throw error;
		}
	};

	addVariant = async ({
		productId,
		name,
		submittedBy,
	}: AddProductVariantService) => {
		try {
			const productVariantToUpdate = await this.productVariantService.create(
				{ name, productId },
				submittedBy,
			);

			const product = await this.productModel.findByPk(productId);
			let categoryProductName;
			if (product) {
				categoryProductName = await this.productCategoryService.getName(
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
			console.error('Error agregando presentación de producto: ', error);
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
			console.error('Error eliminando producto: ', error);
			throw error;
		}
	};
}
