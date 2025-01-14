import { RequestHandler, Router } from 'express';
import { sequelize } from './config/database';
import productRouter from './modules/product/routes';
import productVariantRouter from './modules/product-variant/routes';
import productCategoryRouter from './modules/product-category/routes';
import userRouter from './modules/user/routes';
import customerRouter from './modules/customer/routes';
import dashboardRouter from './modules/dashboard/routes';
import authRouter from './modules/auth/routes';
import quoteRouter from './modules/quote/routes';
import shopRouter from './modules/shop/routes';
import { verifyJWT } from './middlewares/verifyJWT';

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

router.use('/api/v1/auth', authRouter);

router.use(verifyJWT as unknown as RequestHandler);

// Routes that need auth
router.use('/api/v1/dashboard', dashboardRouter);
router.use('/api/v1/products', productRouter);
router.use('/api/v1/product-variants', productVariantRouter);
router.use('/api/v1/product-categories', productCategoryRouter);
router.use('/api/v1/users', userRouter);
router.use('/api/v1/customers', customerRouter);
router.use('/api/v1/quotes', quoteRouter);
router.use('/api/v1/shops', shopRouter);

export default router;
