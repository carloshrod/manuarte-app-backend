import { CashSessionModel } from './model';
import { startOfDay, isSameDay, format, addDays } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { closeCashSessionDTO, OpenCashSessionDTO } from './types';
import { CashMovementModel } from '../cash-movement/model';
import { Op } from 'sequelize';

const COLOMBIA_TZ = 'America/Bogota';

export class CashSessionService {
	private cashSessionModel;

	constructor(cashSessionModel: typeof CashSessionModel) {
		this.cashSessionModel = cashSessionModel;
	}

	getCurrentSession = async (shopId: string) => {
		try {
			if (!shopId) {
				throw new Error('La tienda no existe');
			}

			const today = new Date();
			const todayStart = startOfDay(toZonedTime(today, COLOMBIA_TZ));
			const todayEnd = startOfDay(toZonedTime(addDays(today, 1), COLOMBIA_TZ));

			const todaySession = await CashSessionModel.findOne({
				where: {
					shopId,
					openedAt: { [Op.between]: [todayStart, todayEnd] },
				},
				include: [
					{
						model: CashMovementModel,
						as: 'movements',
						separate: true,
						order: [['createdDate', 'DESC']],
					},
				],
				order: [['openedAt', 'DESC']],
			});

			// Buscar ultima sesión antes de el día de hoy
			const lastSession = await CashSessionModel.findOne({
				where: {
					shopId,
					openedAt: { [Op.lt]: todayStart },
				},
				include: [
					{
						model: CashMovementModel,
						as: 'movements',
						separate: true,
						order: [['createdDate', 'DESC']],
					},
				],
				order: [['openedAt', 'DESC']],
			});

			// Primera sesión en el historial de la tienda
			if (!todaySession && !lastSession) {
				return {
					status: 'first-session',
					canOpen: true,
					canClose: false,
					reason: 'No existen sesiones previas, esta será la primera sesión',
					balance: 0,
				};
			}

			// Verificar si la última sesión está abierta
			if (lastSession?.closedAt === null) {
				const { balance } = await this.getSessionBalance(lastSession?.id);

				return {
					status: 'blocked',
					canOpen: false,
					canClose: true,
					reason: 'Caja pendiente de cierre',
					balance,
					data: lastSession,
				};
			}

			//
			if (!todaySession) {
				const balance = lastSession
					? (await this.getSessionBalance(lastSession?.id)).balance
					: 0;

				return {
					status: 'no-session',
					canOpen: true,
					canClose: false,
					reason: 'No hay caja abierta para hoy',
					balance,
				};
			}

			if (todaySession.closedAt) {
				return {
					status: 'closed',
					canOpen: false,
					canClose: false,
					reason: 'La caja de hoy ya fue cerrada',
					data: todaySession,
				};
			}

			// Caja de hoy abierta
			const { balance } = await this.getSessionBalance(todaySession?.id);

			return {
				status: 'open',
				canOpen: false,
				canClose: true,
				reason: 'Caja abierta y operativa',
				balance,
				data: todaySession,
			};
		} catch (error) {
			console.error('Error obteniendo sesión de caja del día actual');
			throw error;
		}
	};

	getSessionByDate = async (shopId: string, date: string) => {
		try {
			if (!shopId) {
				throw new Error('La tienda no existe');
			}

			const startDate = startOfDay(toZonedTime(date, COLOMBIA_TZ));
			const endDate = startOfDay(toZonedTime(addDays(date, 1), COLOMBIA_TZ));

			const session = await this.cashSessionModel.findOne({
				where: {
					shopId,
					openedAt: { [Op.between]: [startDate, endDate] },
				},
				include: [
					{
						model: CashMovementModel,
						as: 'movements',
						separate: true,
						order: [['createdDate', 'DESC']],
					},
				],
			});

			if (session) {
				return session.dataValues;
			}
		} catch (error) {
			console.error('Error obteniendo sesión de caja');
			throw error;
		}
	};

	openSession = async (openData: OpenCashSessionDTO) => {
		try {
			const {
				shopId,
				declaredOpeningAmount,
				initialPiggyBankAmount,
				comments,
				openedBy,
			} = openData;

			const lastSession = await CashSessionModel.findOne({
				where: { shopId },
				order: [['openedAt', 'DESC']],
			});

			if (lastSession) {
				const openedAtLocal = toZonedTime(lastSession.openedAt, COLOMBIA_TZ);
				const closedAtLocal = lastSession.closedAt
					? toZonedTime(lastSession.closedAt, COLOMBIA_TZ)
					: null;
				const todayLocal = startOfDay(toZonedTime(new Date(), COLOMBIA_TZ));

				const isOpenFromPreviousDay =
					lastSession.closedAt === null &&
					!isSameDay(openedAtLocal, todayLocal);

				const isOpenToday =
					lastSession.closedAt === null && isSameDay(openedAtLocal, todayLocal);

				const isTodaySessionAlreadyClosed =
					lastSession.closedAt !== null &&
					isSameDay(openedAtLocal, todayLocal) &&
					isSameDay(closedAtLocal!, todayLocal);

				if (isOpenFromPreviousDay) {
					throw new Error(
						`La caja del día ${format(openedAtLocal, 'dd/MM/yyyy')} sigue abierta. Debes cerrarla antes de abrir la de hoy`,
					);
				}

				if (isOpenToday) {
					throw new Error('Ya se abrió la caja para el día de hoy');
				}

				if (isTodaySessionAlreadyClosed) {
					throw new Error(
						'La caja del día de hoy ya fue cerrada. No puedes abrirla hasta el día de mañana',
					);
				}
			}

			const declaredAmount = Number(declaredOpeningAmount);
			if (isNaN(declaredAmount)) {
				throw new Error(
					'Valores de apertura declarados debe ser un número válido',
				);
			}

			const isFirstSession = !lastSession;

			const inheritedAmount = Number(lastSession?.declaredClosingAmount ?? 0);
			const openingDifference = declaredAmount - inheritedAmount;

			const inheritedPiggyBankAmount = Number(
				lastSession?.piggyBankAmount ?? 0,
			);

			console.log({ isFirstSession, initialPiggyBankAmount });

			await CashSessionModel.create({
				shopId,
				openedBy,
				openedAt: new Date(),
				openingAmount: inheritedAmount,
				declaredOpeningAmount: declaredAmount,
				openingDifference: isFirstSession ? 0 : openingDifference,
				piggyBankAmount: isFirstSession
					? initialPiggyBankAmount
					: inheritedPiggyBankAmount,
				openingComments: isFirstSession
					? 'Primera apertura de caja. Se asigna diferencia de 0 por falta de referencia previa.'
					: comments,
			});

			const currentSession = await this.getCurrentSession(shopId);

			return currentSession;
		} catch (error) {
			console.error('Error abriendo caja');
			throw error;
		}
	};

	closeSession = async (closeData: closeCashSessionDTO) => {
		try {
			const { shopId, declaredClosingAmount, comments, closedBy } = closeData;

			const lastSessionOpened = await this.cashSessionModel.findOne({
				where: { shopId, closedAt: null },
				order: [['openedAt', 'DESC']],
			});

			if (!lastSessionOpened) {
				throw new Error('No hay una caja abierta para cerrar.');
			}

			const declaredAmount = Number(declaredClosingAmount);
			if (isNaN(declaredAmount)) {
				throw new Error('Los valores declarados deben ser un número válido.');
			}

			// Calcular balance y diferencia
			const { balance } = await this.getSessionBalance(lastSessionOpened?.id);
			const closingDifference = declaredAmount - balance;

			// Validar cierre tardío
			const now = new Date();
			const openedAtLocal = toZonedTime(
				lastSessionOpened.openedAt,
				COLOMBIA_TZ,
			);
			const todayLocal = startOfDay(toZonedTime(now, COLOMBIA_TZ));
			const isLateClosure = !isSameDay(openedAtLocal, todayLocal);

			if (isLateClosure && !comments) {
				throw new Error(
					'Debes ingresar un comentario para realizar un cierre de caja tardío',
				);
			}

			lastSessionOpened.closedAt = now;
			lastSessionOpened.declaredClosingAmount = declaredAmount;
			lastSessionOpened.closingAmount = balance;
			lastSessionOpened.closingDifference = closingDifference;
			lastSessionOpened.closedBy = closedBy;
			lastSessionOpened.comments = comments;

			await lastSessionOpened.save();

			const currentSession = await this.getCurrentSession(shopId);

			return currentSession;
		} catch (error) {
			console.error('Error cerrando caja');
			throw error;
		}
	};

	getSessionBalance = async (sessionId: string) => {
		try {
			const session = await CashSessionModel.findByPk(sessionId);
			if (!session) throw new Error('Sesión no encontrada');

			const cashMovements = await CashMovementModel.findAll({
				where: { cashSessionId: sessionId },
				attributes: ['type', 'amount'],
			});

			const incomes = cashMovements
				.filter(m => m.type === 'INCOME')
				.reduce((sum, m) => sum + Number(m.amount), 0);

			const expenses = cashMovements
				.filter(m => m.type === 'EXPENSE')
				.reduce((sum, m) => sum + Number(m.amount), 0);

			const balance =
				session?.closedAt === null
					? Number(session?.dataValues?.declaredOpeningAmount) +
						incomes -
						expenses
					: session?.dataValues?.declaredClosingAmount;

			return { incomes, expenses, balance };
		} catch (error) {
			console.error('Error obteniendo balance de caja');
			throw error;
		}
	};
}
