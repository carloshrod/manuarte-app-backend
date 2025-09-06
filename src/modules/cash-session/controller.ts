import { Handler } from 'express';
import { CashSessionService } from './service';
import { CustomRequest } from '../types';

export class CashSessionController {
	private cashSessionService;

	constructor(cashSessionService: CashSessionService) {
		this.cashSessionService = cashSessionService;
	}

	getLastSessionByShopId: Handler = async (req, res, next) => {
		try {
			const { shopId } = req.params;

			if (!shopId) {
				res.status(400).json({ error: 'shopId es requerido' });
				return;
			}

			const result =
				await this.cashSessionService.getLastSessionByShopId(shopId);

			res.status(200).json(result);
		} catch (error) {
			next(error);
		}
	};

	openSession: Handler = async (req, res, next) => {
		try {
			const { shopId } = req.params;
			const { declaredOpeningAmount } = req.body;
			const openedBy = (req as CustomRequest).requestedBy;

			const cashSession = await this.cashSessionService.openSession({
				shopId,
				declaredOpeningAmount: Number(declaredOpeningAmount),
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
