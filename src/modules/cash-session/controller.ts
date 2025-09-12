import { Handler } from 'express';
import { CashSessionService } from './service';
import { CustomRequest } from '../types';

export class CashSessionController {
	private cashSessionService;

	constructor(cashSessionService: CashSessionService) {
		this.cashSessionService = cashSessionService;
	}

	getCurrentSession: Handler = async (req, res, next) => {
		try {
			const { shopId } = req.params;

			const result = await this.cashSessionService.getCurrentSession(shopId);

			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	getSessionByDate: Handler = async (req, res, next) => {
		try {
			const { shopId } = req.params;
			const date = (req.query.date as string) || '';

			const result = await this.cashSessionService.getSessionByDate(
				shopId,
				date,
			);

			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	openSession: Handler = async (req, res, next) => {
		try {
			const { shopId } = req.params;
			const { declaredOpeningAmount, initialPiggyBankAmount, comments } =
				req.body;
			const openedBy = (req as CustomRequest).requestedBy;

			const cashSession = await this.cashSessionService.openSession({
				shopId,
				declaredOpeningAmount: Number(declaredOpeningAmount),
				initialPiggyBankAmount,
				comments,
				openedBy,
			});

			res.status(201).json({
				message: 'Caja abierta con éxito',
				cashSession,
			});
		} catch (error) {
			next(error);
		}
	};

	closeSession: Handler = async (req, res, next) => {
		try {
			const { shopId } = req.params;
			const { declaredClosingAmount, comments } = req.body;
			const closedBy = (req as CustomRequest).requestedBy;

			const cashSession = await this.cashSessionService.closeSession({
				shopId,
				declaredClosingAmount: Number(declaredClosingAmount),
				closedBy,
				comments,
			});

			res.status(200).json({
				message: 'Caja cerrada con éxito',
				cashSession,
			});
		} catch (error) {
			next(error);
		}
	};
}
