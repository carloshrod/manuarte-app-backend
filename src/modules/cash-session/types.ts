export type OpenCashSessionDTO = {
	shopId: string;
	declaredOpeningAmount: number;
	initialPiggyBankAmount?: number;
	comments?: string;
	openedBy: string;
};

export type closeCashSessionDTO = {
	shopId: string;
	closedBy: string;
	declaredClosingAmount: number;
	comments?: string;
};
