import React from 'react';
import ReactPDF, { renderToBuffer } from '@react-pdf/renderer';
import PDFDoc, { DocData } from './components/PDFDoc';
import { QuoteService } from '../quote/service';
import { BillingService } from '../billing/service';

export class DocsService {
	constructor(
		private quoteService: QuoteService,
		private billingService: BillingService,
	) {}

	generateQuote = async (serialNumber: string): Promise<Buffer> => {
		const result = await this.quoteService.getOne(serialNumber);

		if (result.status !== 200) {
			throw new Error(`No se pudo obtener la cotización ${serialNumber}`);
		}

		return renderToBuffer(
			React.createElement(PDFDoc, { isQuote: true, data: result.quote as DocData }) as React.ReactElement<ReactPDF.DocumentProps>,
		);
	};

	generateBilling = async (serialNumber: string): Promise<Buffer> => {
		const result = await this.billingService.getOne(serialNumber);

		if (result.status !== 200) {
			throw new Error(`No se pudo obtener la factura ${serialNumber}`);
		}

		return renderToBuffer(
			React.createElement(PDFDoc, { isQuote: false, data: result.billing as DocData }) as React.ReactElement<ReactPDF.DocumentProps>,
		);
	};
}
