import { CashSessionService } from './../cash-session/service';
import { isSameDay, startOfDay } from 'date-fns';
import { CashSessionModel } from '../cash-session/model';
import { CashMovementModel } from './model';
import { toZonedTime } from 'date-fns-tz';
import { CashMovementCategory, CreateCashMovementDTO } from './types';
import { Transaction } from 'sequelize';

const COLOMBIA_TZ = 'America/Bogota';

export class CashMovementService {
	private cashMovementModel;
	private cashSessionService;

	constructor(cashMovementModel: typeof CashMovementModel) {
		this.cashMovementModel = cashMovementModel;
		this.cashSessionService = new CashSessionService(CashSessionModel);
	}

	create = async (
		movementData: CreateCashMovementDTO,
		transaction?: Transaction,
	) => {
		try {
			const {
				shopId,
				billingPaymentId,
				reference,
				amount,
				type,
				category,
				comments,
				createdBy,
			} = movementData;

			this.validateMovementTypeAndCategory(type, category);

			const currentSession =
				await this.cashSessionService.getLastSessionByShopId(shopId);
			if (!currentSession) {
				throw new Error('La sesión de caja no existe.');
			}

			if (currentSession?.data?.closedAt !== null) {
				throw new Error(
					'No puedes registrar movimientos en efectivo. La caja del día de hoy está cerrada.',
				);
			}

			const sessionDateLocal = startOfDay(
				toZonedTime(currentSession?.data?.openedAt, COLOMBIA_TZ),
			);
			const todayLocal = startOfDay(toZonedTime(new Date(), COLOMBIA_TZ));

			if (!isSameDay(sessionDateLocal, todayLocal)) {
				throw new Error(
					'No puedes registrar movimientos en una sesión que no corresponde al día actual.',
				);
			}

			if (!billingPaymentId && !createdBy) {
				throw new Error(
					'Los movimientos manuales deben registrar el usuario que los creó.',
				);
			}

			const newCashMovement = await this.cashMovementModel.create(
				{
					cashSessionId: currentSession?.data?.id,
					billingPaymentId: billingPaymentId ?? null,
					reference,
					amount,
					type: billingPaymentId ? 'INCOME' : type,
					category: billingPaymentId ? CashMovementCategory.SALE : category,
					comments,
					createdBy,
				},
				{ transaction },
			);

			const newBalance = await this.cashSessionService.getSessionBalance(
				currentSession?.data?.id,
			);

			return { newCashMovement, newBalance };
		} catch (error) {
			console.error('Error creando movimiento de caja');
			throw error;
		}
	};

	cancel = async (
		serialNumber: string,
		createdBy: string,
		transaction: Transaction,
	) => {
		try {
			const movementsToCancel = await this.cashMovementModel.findAll({
				where: {
					reference: serialNumber,
				},
			});

			for (const movement of movementsToCancel) {
				await this.cashMovementModel.create(
					{
						cashSessionId: movement?.dataValues?.cashSessionId,
						billingPaymentId: movement?.dataValues?.billingPaymentId,
						reference: serialNumber,
						amount: movement?.dataValues?.amount,
						type: 'EXPENSE',
						category: CashMovementCategory.OTHER,
						comments: `Reversión por anulación de factura ${serialNumber}`,
						createdBy,
					},
					{ transaction },
				);
			}
		} catch (error) {
			console.error('Error anulando movimiento de caja');
			throw error;
		}
	};

	private validateMovementTypeAndCategory = (
		type: 'INCOME' | 'EXPENSE',
		category: CashMovementCategory,
	) => {
		const incomeCategories = [
			CashMovementCategory.SALE,
			CashMovementCategory.OTHER,
		];
		const expenseCategories = [
			CashMovementCategory.DELIVERY,
			CashMovementCategory.INBOUND_SHIPPING,
			CashMovementCategory.PURCHASE,
			CashMovementCategory.CHANGE,
			CashMovementCategory.PIGGY_BANK,
			CashMovementCategory.OTHER,
		];

		if (type === 'INCOME' && !incomeCategories.includes(category)) {
			throw new Error('Categoría no válida para ingresos');
		}

		if (type === 'EXPENSE' && !expenseCategories.includes(category)) {
			throw new Error('Categoría no válida para gastos');
		}
	};
}
