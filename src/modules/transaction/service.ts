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

export class TransactionService {
	private transactionModel;
	private transactionItemService;

	constructor(transactionModel: typeof TransactionModel) {
		this.transactionModel = transactionModel;
		this.transactionItemService = new TransactionItemService(
			TransactionItemModel,
		);
	}

	getAll = async (toId?: string) => {
		try {
			const transactions = await this.transactionModel.findAll({
				where: toId
					? {
							state: TransactionState.PROGRESS,
							type: TransactionType.TRANSFER,
							toId,
						}
					: undefined,
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
			const { items, ...transactionDataRest } = transactionData;

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
				await this.update(
					{ state: TransactionState.SUCCESS },
					transactionData?.transferId,
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

	update = async (transactionData: UpdateTransactionDto, id: string) => {
		try {
			const updatedTransaction = await this.transactionModel.update(
				{ ...transactionData, updatedDate: sequelize.fn('now') },
				{ where: { id } },
			);

			return updatedTransaction;
		} catch (error) {
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
