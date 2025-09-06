export type OpenCashSessionDTO = {
	shopId: string;
	declaredOpeningAmount: number;
	openedBy: string;
};

export type closeCashSessionDTO = {
	shopId: string;
	closedBy: string;
	declaredClosingAmount: number;
	comments?: string;
};
