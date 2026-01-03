import { CashSessionService } from './../cash-session/service';
import { isSameDay, startOfDay } from 'date-fns';
import { CashSessionModel } from '../cash-session/model';
import { CashMovementModel } from './model';
import { toZonedTime } from 'date-fns-tz';
import { CashMovementCategory, CreateCashMovementDTO } from './types';
import { Transaction } from 'sequelize';
import { PiggyBankMovementModel } from '../piggy-bank/model';

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
				customerBalanceMovementId,
				reference,
				amount,
				type,
				category,
				comments,
				createdBy,
			} = movementData;

			this.validateMovementTypeAndCategory(type, category);

			const currentSession =
				await this.cashSessionService.getCurrentSession(shopId);
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

			if (type === 'EXPENSE' && currentSession?.balance < amount) {
				throw new Error('El valor es mayor que el monto disponible en la caja');
			}

			const isShortageCover = category === CashMovementCategory.SHORTAGE_COVER;

			if (isShortageCover) {
				if (currentSession?.data?.accumulatedDifference >= 0) {
					throw new Error(
						'Solo puedes reponer dinero faltante si la diferencia acumulada es negativa',
					);
				}

				if (amount !== Math.abs(currentSession?.data?.accumulatedDifference)) {
					throw new Error(
						`El monto debe ser igual o menor a ${Math.abs(currentSession?.data?.accumulatedDifference)}`,
					);
				}

				if (!comments) {
					throw new Error(
						'Si estás reponiendo dinero faltante, por favor deja un comentario',
					);
				}
			}

			await this.cashMovementModel.create(
				{
					cashSessionId: currentSession?.data?.id,
					billingPaymentId: billingPaymentId ?? null,
					customerBalanceMovementId,
					reference,
					amount,
					type: billingPaymentId ? 'INCOME' : type,
					category: billingPaymentId ? CashMovementCategory.SALE : category,
					comments,
					createdBy,
				},
				{ transaction },
			);

			if (isShortageCover) {
				const newAccumulatedDifference =
					Number(currentSession?.data?.accumulatedDifference) + amount;

				await CashSessionModel.update(
					{
						accumulatedDifference: newAccumulatedDifference,
					},
					{
						where: { id: currentSession?.data?.id },
					},
				);
			}

			if (category === CashMovementCategory.PIGGY_BANK) {
				await PiggyBankMovementModel.create(
					{
						cashSessionId: currentSession?.data?.id,
						amount,
						type: 'DEPOSIT',
						createdBy,
					},
					{ transaction },
				);

				const newPiggyBankAmount =
					Number(currentSession?.data?.piggyBankAmount) + Number(amount);

				await CashSessionModel.update(
					{ piggyBankAmount: newPiggyBankAmount },
					{ where: { id: currentSession?.data?.id } },
				);
			}

			const currentSessionUpdated =
				await this.cashSessionService.getCurrentSession(shopId);

			return currentSessionUpdated;
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

	updateByCustomerBalanceMovementId = async (
		customerBalanceMovementId: string,
		updateData: { billingPaymentId?: string; reference?: string },
		transaction?: Transaction,
	) => {
		try {
			const movement = await this.cashMovementModel.findOne({
				where: { customerBalanceMovementId },
				transaction,
			});

			if (movement) {
				await movement.update(updateData, { transaction });
			}
		} catch (error) {
			console.error(
				'Error actualizando movimiento de caja por customerBalanceMovementId',
			);
			throw error;
		}
	};

	private validateMovementTypeAndCategory = (
		type: 'INCOME' | 'EXPENSE',
		category: CashMovementCategory,
	) => {
		const incomeCategories = [
			CashMovementCategory.SALE,
			CashMovementCategory.SHORTAGE_COVER,
			CashMovementCategory.ADVANCE_PAYMENT,
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
