import { BankTransferMovementModel } from './model';
import { Transaction } from 'sequelize';
import { CreateBankTransferMovementDTO } from './types';
import { addDays, startOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { BillingPaymentModel } from '../billing-payment/model';
import { Op } from 'sequelize';
import { BillingModel } from '../billing/model';
import { CustomerModel } from '../customer/model';
import { PersonModel } from '../person/model';
import { CustomerBalanceMovementModel } from '../customer-balance/movement-model';

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
				include: [
					{
						model: BillingPaymentModel,
						as: 'payment',
						attributes: ['id'],
						include: [
							{
								model: BillingModel,
								as: 'billing',
								attributes: ['id'],
								include: [
									{
										model: CustomerModel,
										as: 'customer',
										attributes: ['id'],
										include: [
											{
												model: PersonModel,
												as: 'person',
												attributes: ['fullName'],
											},
										],
									},
								],
							},
						],
					},
					{
						model: CustomerBalanceMovementModel,
						as: 'customerBalanceMovement',
						attributes: ['id'],
						include: [
							{
								model: CustomerModel,
								as: 'customer',
								attributes: ['id'],
								include: [
									{
										model: PersonModel,
										as: 'person',
										attributes: ['fullName'],
									},
								],
							},
						],
					},
				],
				order: [['createdDate', 'DESC']],
			});

			return movements.map(m => {
				const movement = m.toJSON();
				const customerName =
					movement.payment?.billing?.customer?.person?.fullName ??
					movement.customerBalanceMovement?.customer?.person?.fullName ??
					null;

				delete movement.payment;
				delete movement.customerBalanceMovement;

				return {
					...movement,
					customerName,
				};
			});
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
				customerBalanceMovementId,
				reference,
				amount,
				type,
				createdBy,
				comments,
				paymentMethod,
			} = movementData;

			const newBankTransferMovement =
				await this.bankTransferMovementModel.create(
					{
						shopId,
						billingPaymentId: billingPaymentId ?? null,
						customerBalanceMovementId: customerBalanceMovementId ?? null,
						reference,
						amount,
						type: billingPaymentId ? 'INCOME' : type,
						paymentMethod,
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

	updateByCustomerBalanceMovementId = async (
		customerBalanceMovementId: string,
		updateData: { billingPaymentId?: string; reference?: string },
		transaction?: Transaction,
	) => {
		try {
			const movement = await this.bankTransferMovementModel.findOne({
				where: { customerBalanceMovementId },
				transaction,
			});

			if (movement) {
				await movement.update(updateData, { transaction });
			}
		} catch (error) {
			console.error(
				'Error actualizando movimiento de transferencia por customerBalanceMovementId',
			);
			throw error;
		}
	};
}
