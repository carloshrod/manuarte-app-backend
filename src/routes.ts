import { Router } from 'express';
import { sequelize } from './config/database';
import productRouter from './modules/product/routes';
import productVariantRouter from './modules/product-variant/routes';
import productCategoryRouter from './modules/product-category/routes';

const router = Router();

router.get('/', (_req, res) => {
	res.send('Manuarte App - Backend');
});

router.get('/api/v1/ping', async (_req, res) => {
	try {
		await sequelize.authenticate();
		res.status(200).send({
			apiSays: 'Server status is OK!',
			PostgreSays: 'Database connection is OK!',
		});
	} catch (error) {
		console.error(error);
	}
});

router.use('/api/v1/products', productRouter);
router.use('/api/v1/product-variants', productVariantRouter);
router.use('/api/v1/product-categories', productCategoryRouter);

export default router;
