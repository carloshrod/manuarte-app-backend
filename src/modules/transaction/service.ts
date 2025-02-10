import { sequelize } from '../../config/database';
import { StockModel } from '../stock/model';
import { TransactionItemModel } from '../transaction-item/model';
import { TransactionItemService } from '../transaction-item/service';
import { TransactionModel } from './model';
import {
	CreateTransactionDto,
	TransactionStatus,
	TransactionType,
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

	getAll = async () => {
		try {
			const transactions = await this.transactionModel.findAll({
				attributes: [
					'id',
					'name',
					'state',
					'type',
					'fromId',
					[sequelize.col('stockFrom.name'), 'fromName'],
					'toId',
					[sequelize.col('stockTo.name'), 'toName'],
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

			const currentDate = new Date();
			const timestamp = currentDate.getTime();
			const formattedDate = new Date(timestamp).toLocaleDateString('es-EC', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
			});
			const name = `${transactionData?.type}_${formattedDate}_${timestamp}`;

			const newTransaction = await this.transactionModel.create(
				{
					...transactionDataRest,
					name,
					state:
						transactionData?.type !== TransactionType.TRANSFER
							? TransactionStatus.SUCCESS
							: TransactionStatus.PROGRESS,
					shippingDate: sequelize.fn('now'),
				},
				{ transaction: sqlTransaction },
			);

			for (const item of items) {
				await this.transactionItemService.create(
					{ ...item, transactionId: newTransaction.dataValues.id },
					transactionData?.type === TransactionType.ENTER,
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
}
