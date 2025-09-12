import { BankTransferMovementModel } from './model';
import { Transaction } from 'sequelize';
import { CreateBankTransferMovementDTO } from './types';
import { addDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { BillingPaymentModel } from '../billing-payment/model';
import { sequelize } from '../../config/database';
import { Op } from 'sequelize';

const COLOMBIA_TZ = 'America/Bogota';

export class BankTransferMovementService {
	private bankTransferMovementModel;

	constructor(bankTransferMovementModel: typeof BankTransferMovementModel) {
		this.bankTransferMovementModel = bankTransferMovementModel;
	}

	getAllByDate = async (shopId: string, date?: string) => {
		try {
			const currentDate = new Date();
			const targetDate = date ?? currentDate;
			const startDate = startOfDay(toZonedTime(targetDate, COLOMBIA_TZ));
			const endDate = startOfDay(
				toZonedTime(addDays(targetDate, 1), COLOMBIA_TZ),
			);

			const movements = await this.bankTransferMovementModel.findAll({
				where: {
					shopId,
					createdDate: { [Op.between]: [startDate, endDate] },
				},
				attributes: {
					include: [[sequelize.col('payment.paymentMethod'), 'paymentMethod']],
				},
				include: [
					{
						model: BillingPaymentModel,
						as: 'payment',
						attributes: [],
					},
				],
				order: [['createdDate', 'DESC']],
			});

			return movements;
		} catch (error) {
			console.error('Error obteniendo movimientos de transferencia bancaria');
			throw error;
		}
	};

	create = async (
		movementData: CreateBankTransferMovementDTO,
		transaction?: Transaction,
	) => {
		try {
			const {
				shopId,
				billingPaymentId,
				reference,
				amount,
				type,
				createdBy,
				comments,
			} = movementData;

			const newBankTransferMovement =
				await this.bankTransferMovementModel.create(
					{
						shopId,
						billingPaymentId: billingPaymentId ?? null,
						reference,
						amount,
						type: billingPaymentId ? 'INCOME' : type,
						comments,
						createdBy,
					},
					{ transaction },
				);

			return newBankTransferMovement;
		} catch (error) {
			console.error('Error creando movimiento de transferencia bancaria');
			throw error;
		}
	};

	cancel = async (
		serialNumber: string,
		createdBy: string,
		transaction: Transaction,
	) => {
		try {
			const movementsToCancel = await this.bankTransferMovementModel.findAll({
				where: {
					reference: serialNumber,
				},
			});

			for (const movement of movementsToCancel) {
				await this.bankTransferMovementModel.create(
					{
						shopId: movement?.dataValues?.shopId,
						billingPaymentId: movement?.dataValues?.billingPaymentId,
						reference: serialNumber,
						amount: movement?.dataValues?.amount,
						type: 'EXPENSE',
						comments: `Reversión por anulación de factura ${serialNumber}`,
						createdBy,
					},
					{ transaction },
				);
			}
		} catch (error) {
			console.error('Error anulando movimiento de transferencia bancaria');
			throw error;
		}
	};
}
