import { Transaction, Op } from 'sequelize';
import { sequelize } from '../../config/database';
import { CustomerBalanceModel } from './model';
import { CustomerBalanceMovementModel } from './movement-model';
import {
	AddCreditDto,
	UseBalanceDto,
	CustomerBalanceMovementFilters,
} from './types';
import { endOfDay, parseISO, startOfDay } from 'date-fns';
import { CashMovementService } from '../cash-movement/service';
import { CashMovementModel } from '../cash-movement/model';
import { BankTransferMovementService } from '../bank-transfer-movement/service';
import { BankTransferMovementModel } from '../bank-transfer-movement/model';
import { CashMovementCategory } from '../cash-movement/types';

export class CustomerBalanceService {
	private customerBalanceModel;
	private customerBalanceMovementModel;
	private cashMovementService;
	private bankTransferMovementService;

	constructor(customerBalanceModel: typeof CustomerBalanceModel) {
		this.customerBalanceModel = customerBalanceModel;
		this.customerBalanceMovementModel = CustomerBalanceMovementModel;
		this.cashMovementService = new CashMovementService(CashMovementModel);
		this.bankTransferMovementService = new BankTransferMovementService(
			BankTransferMovementModel,
		);
	}

	getBalance = async (customerId: string, currency: 'COP' | 'USD') => {
		try {
			const balance = await this.customerBalanceModel.findOne({
				where: { customerId, currency },
			});

			return Number(balance?.dataValues?.balance || 0);
		} catch (error) {
			console.error('Error getting customer balance');
			throw error;
		}
	};

	addCredit = async (data: AddCreditDto, externalTransaction?: Transaction) => {
		const localTransaction =
			externalTransaction || (await sequelize.transaction());
		try {
			// Obtener o crear saldo del cliente
			const [customerBalance] = await this.customerBalanceModel.findOrCreate({
				where: { customerId: data.customerId, currency: data.currency },
				defaults: {
					customerId: data.customerId,
					currency: data.currency,
					balance: 0,
				},
				transaction: localTransaction,
			});

			const balanceBefore = Number(customerBalance.balance);
			const balanceAfter = balanceBefore + Number(data.amount);

			// Actualizar saldo
			await customerBalance.update(
				{ balance: balanceAfter },
				{ transaction: localTransaction },
			);

			// Registrar movimiento
			const movement = await this.customerBalanceMovementModel.create(
				{
					customerId: data.customerId,
					quoteId: data.quoteId || null,
					billingId: data.billingId || null,
					type: 'CREDIT',
					category: data.category,
					paymentMethod: data.paymentMethod || null,
					currency: data.currency,
					amount: data.amount,
					balanceBefore,
					balanceAfter,
					comments: data.comments || null,
					createdBy: data.createdBy,
				},
				{ transaction: localTransaction },
			);

			// Crear movimiento de caja o transferencia
			if (data?.paymentMethod && data?.shopId) {
				if (data.paymentMethod === 'CASH') {
					await this.cashMovementService.create(
						{
							shopId: data.shopId,
							customerBalanceMovementId: movement?.dataValues?.id, // Vincular con el movimiento de balance
							amount: Number(data.amount),
							type: 'INCOME',
							category: CashMovementCategory.ADVANCE_PAYMENT,
							createdBy: data.createdBy,
						},
						localTransaction,
					);
				} else {
					await this.bankTransferMovementService.create(
						{
							shopId: data.shopId,
							customerBalanceMovementId: movement?.dataValues?.id, // Vincular con el movimiento de balance
							amount: Number(data.amount),
							type: 'INCOME',
							createdBy: data.createdBy,
						},
						localTransaction,
					);
				}
			}

			if (!externalTransaction) await localTransaction.commit();

			return {
				status: 201,
				movement,
			};
		} catch (error) {
			if (!externalTransaction) await localTransaction.rollback();
			console.error('Error adding credit to customer balance');
			throw error;
		}
	};

	// Usar saldo (debitar)
	useBalance = async (
		data: UseBalanceDto,
		externalTransaction?: Transaction,
	) => {
		const localTransaction =
			externalTransaction || (await sequelize.transaction());
		try {
			const customerBalance = await this.customerBalanceModel.findOne({
				where: { customerId: data.customerId, currency: data.currency },
				transaction: localTransaction,
			});

			if (!customerBalance) {
				throw new Error('El cliente no tiene saldo disponible');
			}

			const balanceBefore = Number(customerBalance.balance);

			if (balanceBefore < Number(data.amount)) {
				throw new Error(
					`Saldo insuficiente. Disponible: ${balanceBefore}, Requerido: ${data.amount}`,
				);
			}

			const balanceAfter = balanceBefore - Number(data.amount);

			// Actualizar saldo
			await customerBalance.update(
				{ balance: balanceAfter },
				{ transaction: localTransaction },
			);

			// Registrar movimiento
			const movement = await this.customerBalanceMovementModel.create(
				{
					customerId: data.customerId,
					quoteId: data.quoteId || null,
					billingId: data.billingId || null,
					type: 'DEBIT',
					category: data.category,
					currency: data.currency,
					amount: data.amount,
					balanceBefore,
					balanceAfter,
					comments: data.comments || null,
					createdBy: data.createdBy,
				},
				{ transaction: localTransaction },
			);

			if (!externalTransaction) await localTransaction.commit();

			return {
				status: 200,
				movement,
			};
		} catch (error) {
			if (!externalTransaction) await localTransaction.rollback();
			console.error('Error using customer balance');
			throw error;
		}
	};

	// Obtener historial de movimientos
	getMovements = async (
		customerId: string,
		page: number = 1,
		pageSize: number = 30,
		filters: CustomerBalanceMovementFilters = {},
	) => {
		try {
			const whereClause: Record<string, unknown> = {
				customerId,
			};

			if (filters.currency) {
				whereClause.currency = filters.currency;
			}

			// Filtro múltiple para type
			if (filters.type) {
				if (Array.isArray(filters.type)) {
					whereClause.type = { [Op.in]: filters.type };
				} else {
					whereClause.type = filters.type;
				}
			}

			// Filtro múltiple para category
			if (filters.category) {
				if (Array.isArray(filters.category)) {
					whereClause.category = { [Op.in]: filters.category };
				} else {
					whereClause.category = filters.category;
				}
			}

			// Filtro de rango de fechas
			if (filters.dateStart && filters.dateEnd) {
				const start = startOfDay(parseISO(filters.dateStart));
				const end = endOfDay(parseISO(filters.dateEnd));

				whereClause.createdDate = {
					[Op.between]: [start, end],
				};
			}

			const offset = (page - 1) * pageSize;

			const { rows: movements, count: total } =
				await this.customerBalanceMovementModel.findAndCountAll({
					where: whereClause,
					order: [['createdDate', 'DESC']],
					limit: pageSize,
					offset,
				});

			return {
				status: 200,
				data: {
					movements,
					total,
					page,
					pageSize,
					totalPages: Math.ceil(total / pageSize),
				},
			};
		} catch (error) {
			console.error('Error getting customer balance movements');
			throw error;
		}
	};

	// Obtener todos los saldos de un cliente
	getAllBalances = async (customerId: string) => {
		try {
			const balances = await this.customerBalanceModel.findAll({
				where: { customerId },
			});

			return {
				status: 200,
				data: balances,
			};
		} catch (error) {
			console.error('Error getting customer balances');
			throw error;
		}
	};

	// Actualizar movimientos de caja/transferencia con información de factura
	updateMovementsWithBillingInfo = async (
		customerBalanceMovementId: string,
		billingPaymentId: string,
		reference: string,
		transaction?: Transaction,
	) => {
		try {
			// Actualizar movimiento de caja si existe
			await this.cashMovementService.updateByCustomerBalanceMovementId(
				customerBalanceMovementId,
				{
					billingPaymentId,
					reference,
				},
				transaction,
			);

			// Actualizar movimiento de transferencia si existe
			await this.bankTransferMovementService.updateByCustomerBalanceMovementId(
				customerBalanceMovementId,
				{
					billingPaymentId,
					reference,
				},
				transaction,
			);

			return {
				status: 200,
				message: 'Movimientos actualizados correctamente',
			};
		} catch (error) {
			console.error('Error updating movements with billing info');
			throw error;
		}
	};

	// Obtener movimientos de crédito con saldo disponible para heredar métodos de pago (FIFO)
	getAvailableMovements = async (
		customerId: string,
		currency: 'COP' | 'USD',
		transaction?: Transaction,
	) => {
		try {
			// Obtener todos los créditos ordenados cronológicamente (FIFO)
			const creditMovements = await this.customerBalanceMovementModel.findAll({
				where: {
					customerId,
					currency,
					type: 'CREDIT',
				},
				order: [['createdDate', 'ASC']],
				transaction,
			});

			// Obtener todos los débitos ordenados cronológicamente
			const debitMovements = await this.customerBalanceMovementModel.findAll({
				where: {
					customerId,
					currency,
					type: 'DEBIT',
				},
				order: [['createdDate', 'ASC']],
				transaction,
			});

			// Aplicar débitos a créditos usando FIFO
			const creditsWithAvailable = creditMovements.map(credit => ({
				...credit.dataValues,
				availableAmount: Number(credit.amount),
				quoteSerialNumber: null,
			}));

			let totalDebits = 0;
			debitMovements.forEach(debit => {
				totalDebits += Number(debit.amount);
			});

			// Aplicar los débitos a los créditos en orden FIFO
			let remainingDebits = totalDebits;
			for (const credit of creditsWithAvailable) {
				if (remainingDebits <= 0) break;

				const creditAmount = Number(credit.availableAmount);
				if (remainingDebits >= creditAmount) {
					// Este crédito fue completamente consumido
					credit.availableAmount = 0;
					remainingDebits -= creditAmount;
				} else {
					// Este crédito fue parcialmente consumido
					credit.availableAmount = creditAmount - remainingDebits;
					remainingDebits = 0;
				}
			}

			// Retornar solo los créditos con saldo disponible
			return creditsWithAvailable.filter(credit => credit.availableAmount > 0);
		} catch (error) {
			console.error('Error getting available movements');
			throw error;
		}
	};
}
