import { CustomerBalanceController } from './controller';
import { Router } from 'express';
import { authorize } from '../../middlewares/authorize';
import { CustomerPermissions } from '../permission/enums';
import { CustomerBalanceService } from './service';
import { CustomerBalanceModel } from './model';

const router = Router();

const customerBalanceService = new CustomerBalanceService(CustomerBalanceModel);

const customerBalanceController = new CustomerBalanceController(
	customerBalanceService,
);

// Obtener saldo por moneda
router.get(
	'/:customerId',
	authorize(CustomerPermissions.CUSTOMER_READ),
	customerBalanceController.getBalance,
);

// Obtener todos los saldos del cliente
router.get(
	'/:customerId/all',
	authorize(CustomerPermissions.CUSTOMER_READ),
	customerBalanceController.getAllBalances,
);

// Agregar crédito al cliente
router.post(
	'/:customerId/credit',
	authorize(CustomerPermissions.CUSTOMER_UPDATE),
	customerBalanceController.addCredit,
);

// Usar saldo del cliente
router.post(
	'/:customerId/use-balance',
	authorize(CustomerPermissions.CUSTOMER_UPDATE),
	customerBalanceController.useBalance,
);

// Obtener movimientos del cliente
router.get(
	'/:customerId/movements',
	authorize(CustomerPermissions.CUSTOMER_READ),
	customerBalanceController.getMovements,
);

export default router;
