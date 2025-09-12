import { CashSessionService } from './../cash-session/service';
import { isSameDay, startOfDay } from 'date-fns';
import { CashSessionModel } from '../cash-session/model';
import { toZonedTime } from 'date-fns-tz';
import { PiggyBankMovementModel } from './model';
import { CreatePiggyBankMovementDTO } from './types';

const COLOMBIA_TZ = 'America/Bogota';

export class PiggyBankMovementService {
	private piggyBankMovementModel;
	private cashSessionService;

	constructor(piggyBankMovementModel: typeof PiggyBankMovementModel) {
		this.piggyBankMovementModel = piggyBankMovementModel;
		this.cashSessionService = new CashSessionService(CashSessionModel);
	}

	withDraw = async (movementData: CreatePiggyBankMovementDTO) => {
		try {
			const { shopId, amount, comments, createdBy } = movementData;

			const currentSession =
				await this.cashSessionService.getCurrentSession(shopId);
			if (!currentSession) {
				throw new Error('La sesión de caja no existe.');
			}

			if (currentSession?.data?.closedAt !== null) {
				throw new Error(
					'No puedes registrar movimientos en la alcancía. La caja del día de hoy está cerrada.',
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

			if (currentSession?.data?.piggyBankAmount < amount) {
				throw new Error(
					'El monto a retirar es mayor que el disponible en la alcancía',
				);
			}

			await this.piggyBankMovementModel.create({
				cashSessionId: currentSession?.data?.id,
				amount,
				type: 'WITHDRAW',
				comments,
				createdBy,
			});

			const newPiggyBankAmount =
				Number(currentSession?.data?.piggyBankAmount) - Number(amount);

			await CashSessionModel.update(
				{ piggyBankAmount: newPiggyBankAmount },
				{ where: { id: currentSession?.data?.id } },
			);

			const currentSessionUpdated =
				await this.cashSessionService.getCurrentSession(shopId);

			return currentSessionUpdated;
		} catch (error) {
			console.error('Error creando movimiento de caja');
			throw error;
		}
	};
}
