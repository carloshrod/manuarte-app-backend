import { CashSessionModel } from './model';
import { startOfDay, isSameDay, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { closeCashSessionDTO, OpenCashSessionDTO } from './types';
import { CashMovementModel } from '../cash-movement/model';

const COLOMBIA_TZ = 'America/Bogota';

export class CashSessionService {
	private cashSessionModel;
	private cashMovementModel;

	constructor(cashSessionModel: typeof CashSessionModel) {
		this.cashSessionModel = cashSessionModel;
		this.cashMovementModel = CashMovementModel;
	}

	getLastSessionByShopId = async (shopId: string) => {
		try {
			const session = await this.cashSessionModel.findOne({
				where: { shopId },
				include: [
					{
						model: this.cashMovementModel,
						as: 'movements',
						separate: true,
						order: [['createdDate', 'DESC']],
					},
				],
				order: [['openedAt', 'DESC']],
			});

			if (!session) {
				return {
					canOpen: true,
					canRegisterMovements: false,
					initialAmount: 0,
					reason: 'Primera apertura de caja',
				};
			}

			const balance = await this.getSessionBalance(session?.dataValues?.id);

			if (session.closedAt === null) {
				const openedAtLocal = toZonedTime(session.openedAt, COLOMBIA_TZ);
				const todayLocal = startOfDay(toZonedTime(new Date(), COLOMBIA_TZ));

				if (isSameDay(openedAtLocal, todayLocal)) {
					return {
						canOpen: false,
						canRegisterMovements: true,
						reason: 'Caja abierta para el día de hoy',
						balance,
						data: session.dataValues,
					};
				} else {
					return {
						canOpen: false,
						canRegisterMovements: false,
						reason:
							'Caja abierta del día anterior. Debe cerrarse antes de continuar.',
						balance,
						data: session.dataValues,
					};
				}
			}

			return {
				canOpen: true,
				canRegisterMovements: false,
				initialAmount: Number(session.declaredClosingAmount ?? 0),
				reason: 'Caja del día anterior cerrada correctamente',
				balance,
				data: session.dataValues,
			};
		} catch (error) {
			console.error('Error obteniendo sesión de caja');
			throw error;
		}
	};

	openSession = async (openData: OpenCashSessionDTO) => {
		try {
			const { shopId, declaredOpeningAmount, openedBy } = openData;

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

				const isOpenToday =
					lastSession.closedAt === null && isSameDay(openedAtLocal, todayLocal);

				const isTodaySessionAlreadyClosed =
					lastSession.closedAt !== null &&
					isSameDay(openedAtLocal, todayLocal) &&
					isSameDay(closedAtLocal!, todayLocal);

				const isOpenFromPreviousDay =
					lastSession.closedAt === null &&
					!isSameDay(openedAtLocal, todayLocal);

				if (isOpenToday) {
					throw new Error('Ya se abrió la caja para el día de hoy');
				}

				if (isTodaySessionAlreadyClosed) {
					throw new Error(
						'La caja del día de hoy ya fue cerrada. No puedes abrirla hasta el día de mañana',
					);
				}

				if (isOpenFromPreviousDay) {
					throw new Error(
						`La caja del día ${format(openedAtLocal, 'dd/MM/yyyy')} sigue abierta. Debes cerrarla antes de abrir la de hoy`,
					);
				}
			}

			const declaredAmount = Number(declaredOpeningAmount);
			if (isNaN(declaredAmount)) {
				throw new Error(
					'Valor de apertura declarado debe ser un número válido',
				);
			}

			const isFirstSession = !lastSession;
			const inheritedAmount = Number(lastSession?.declaredClosingAmount ?? 0);
			const openingDifference = declaredAmount - inheritedAmount;

			await CashSessionModel.create({
				shopId,
				openedBy,
				openedAt: new Date(),
				openingAmount: inheritedAmount,
				declaredOpeningAmount: declaredAmount,
				openingDifference: isFirstSession ? 0 : openingDifference,
				comments: isFirstSession
					? 'Primera apertura de caja. Se asigna diferencia de 0 por falta de referencia previa.'
					: null,
			});

			const currentSession = await this.getLastSessionByShopId(shopId);

			return currentSession;
		} catch (error) {
			console.error('Error abriendo caja');
			throw error;
		}
	};

	closeSession = async (closeData: closeCashSessionDTO) => {
		try {
			const { shopId, declaredClosingAmount, closedBy, comments } = closeData;

			const lastSession = await this.cashSessionModel.findOne({
				where: { shopId },
				order: [['openedAt', 'DESC']],
			});

			if (!lastSession || lastSession.closedAt !== null) {
				throw new Error('No hay una caja abierta para cerrar.');
			}

			const now = new Date();
			const openedAtLocal = toZonedTime(lastSession.openedAt, COLOMBIA_TZ);
			const todayLocal = startOfDay(toZonedTime(now, COLOMBIA_TZ));

			const isLateClosure = !isSameDay(openedAtLocal, todayLocal);

			const declaredAmount = Number(declaredClosingAmount);
			if (isNaN(declaredAmount)) {
				throw new Error(
					'El valor de cierre declarado debe ser un número válido.',
				);
			}

			const { balance } = await this.getLastSessionByShopId(shopId);
			if (!balance) {
				throw new Error('Error calculando el monto de cierre de caja');
			}
			const closingDifference = declaredAmount - balance;

			if (isLateClosure && !comments) {
				throw new Error(
					'Debes ingresar un comentario para cerrar una caja abierta desde un día anterior.',
				);
			}

			lastSession.closedAt = now;
			lastSession.declaredClosingAmount = declaredAmount;
			lastSession.closingAmount = balance;
			lastSession.closingDifference = closingDifference;
			lastSession.closedBy = closedBy;
			lastSession.comments = comments;

			await lastSession.save();

			const currentSession = await this.getLastSessionByShopId(shopId);

			return currentSession;
		} catch (error) {
			console.error('Error cerrando caja');
			throw error;
		}
	};

	getSessionBalance = async (sessionId: string): Promise<number> => {
		const session = await CashSessionModel.findByPk(sessionId);
		if (!session) throw new Error('Sesión no encontrada');

		const movements = await CashMovementModel.findAll({
			where: { cashSessionId: sessionId },
			attributes: ['type', 'amount'],
		});

		const incomes = movements
			.filter(m => m.type === 'INCOME')
			.reduce((sum, m) => sum + Number(m.amount), 0);

		const expenses = movements
			.filter(m => m.type === 'EXPENSE')
			.reduce((sum, m) => sum + Number(m.amount), 0);

		const balance =
			session?.closedAt === null
				? Number(session?.dataValues?.declaredOpeningAmount) +
					incomes -
					expenses
				: session?.dataValues?.declaredClosingAmount;

		return balance;
	};
}
