import { Transaction } from 'sequelize';
import { sequelize } from '../../config/database';
import { StockModel } from '../stock/model';
import { TransactionItemModel } from '../transaction-item/model';
import { TransactionItemService } from '../transaction-item/service';
import { TransactionModel } from './model';
import {
	CreateTransactionDto,
	TransactionState,
	TransactionType,
	UpdateTransactionDto,
} from './types';
import { Op } from 'sequelize';

export class TransactionService {
	private transactionModel;
	private transactionItemService;

	constructor(transactionModel: typeof TransactionModel) {
		this.transactionModel = transactionModel;
		this.transactionItemService = new TransactionItemService(
			TransactionItemModel,
		);
	}

	getAll = async (toId?: string, stockId?: string) => {
		try {
			let condition = undefined;

			if (toId) {
				condition = {
					state: TransactionState.PROGRESS,
					type: TransactionType.TRANSFER,
					toId,
				};
			}

			if (stockId) {
				condition = {
					[Op.or]: [{ fromId: stockId }, { toId: stockId }],
				};
			}

			const transactions = await this.transactionModel.findAll({
				where: condition,
				attributes: [
					'id',
					'name',
					'state',
					'type',
					'fromId',
					[sequelize.col('stockFrom.name'), 'fromName'],
					'toId',
					[sequelize.col('stockTo.name'), 'toName'],
					'supplierId',
					'description',
					'createdDate',
				],
				include: [
					{
						model: StockModel,
						as: 'stockFrom',
						attributes: [],
					},
					{
						model: StockModel,
						as: 'stockTo',
						attributes: [],
					},
				],
				order: [['createdDate', 'DESC']],
			});

			return { status: 200, transactions };
		} catch (error) {
			console.error('Error obteniendo transacciones');
			throw error;
		}
	};

	create = async (transactionData: CreateTransactionDto) => {
		const sqlTransaction = await sequelize.transaction();
		try {
			const existing = await this.transactionModel.findOne({
				where: { clientRequestId: transactionData?.clientRequestId },
			});
			if (existing) {
				throw new Error('Ya se procesó esta solicitud');
			}

			const { items, ...transactionDataRest } = transactionData;

			if (items.length === 0) {
				throw new Error(
					'Es necesario al menos 1 item para crear una transacción',
				);
			}

			const newTransaction = await this.transactionModel.create(
				{
					...transactionDataRest,
					name: this.generateName(transactionData?.type),
					state:
						transactionData?.type !== TransactionType.TRANSFER
							? TransactionState.SUCCESS
							: TransactionState.PROGRESS,
					shippingDate: sequelize.fn('now'),
				},
				{ transaction: sqlTransaction },
			);

			for (const item of items) {
				await this.transactionItemService.create(
					{
						transactionItemData: {
							...item,
							transactionId: newTransaction.dataValues.id,
						},
						isEnter: transactionData?.type === TransactionType.ENTER,
					},
					sqlTransaction,
				);
			}

			if (transactionData?.transferId) {
				await this.updateTransfer(
					{ state: TransactionState.SUCCESS },
					transactionData?.transferId,
					sqlTransaction,
				);
			}

			await sqlTransaction.commit();

			return { status: 200, newTransaction };
		} catch (error) {
			await sqlTransaction.rollback();
			console.error('Error creando transacción');
			throw error;
		}
	};

	updateTransfer = async (
		transactionData: UpdateTransactionDto,
		id: string,
		sqlTransaction?: Transaction,
	) => {
		const mainSqlTransaction =
			sqlTransaction || (await sequelize.transaction());
		try {
			const transactionToUpdate = await this.transactionModel.findByPk(id, {
				transaction: mainSqlTransaction,
			});
			if (!transactionToUpdate) {
				throw new Error('Transferencia no encontrada');
			}

			await transactionToUpdate.update(
				{ ...transactionData },
				{
					transaction: mainSqlTransaction,
				},
			);

			if (
				transactionData?.items &&
				transactionToUpdate?.dataValues?.state === TransactionState.PROGRESS
			) {
				for (const item of transactionData.items) {
					await this.transactionItemService.update(item, mainSqlTransaction);
				}
			}

			if (!sqlTransaction) {
				await mainSqlTransaction.commit();
			}

			return { status: 200, updatedTransaction: transactionToUpdate };
		} catch (error) {
			if (!sqlTransaction) {
				await mainSqlTransaction.rollback();
			}
			console.error('Error actualizando transacción');
			throw error;
		}
	};

	private generateName = (transactionType: TransactionType) => {
		const currentDate = new Date();
		const timestamp = currentDate.getTime();
		const formattedDate = new Date(timestamp).toLocaleDateString('es-EC', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
		});

		return `${transactionType}_${formattedDate}_${timestamp}`;
	};
}
