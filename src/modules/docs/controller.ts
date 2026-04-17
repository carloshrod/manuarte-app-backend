import { Handler } from 'express';
import { DocsService } from './service';
import { QuoteService } from '../quote/service';
import { BillingService } from '../billing/service';
import { WhatsAppDocumentService } from '../whatsapp/document.service';
import { calculateTotals } from './utils';

export class DocsController {
	private docsService;
	private quoteService;
	private billingService;
	private waDocService;

	constructor(
		docsService: DocsService,
		quoteService: QuoteService,
		billingService: BillingService,
		waDocService: WhatsAppDocumentService,
	) {
		this.docsService = docsService;
		this.quoteService = quoteService;
		this.billingService = billingService;
		this.waDocService = waDocService;
	}

	getPdf: Handler = async (req, res, next) => {
		try {
			const { serialNumber } = req.params;

			const buffer = await this.docsService.generateQuote(serialNumber);

			res.set({
				'Content-Type': 'application/pdf',
				'Content-Disposition': `inline; filename="CTZ-${serialNumber}.pdf"`,
				'Content-Length': buffer.length,
			});

			res.end(buffer);
		} catch (error) {
			next(error);
		}
	};

	sendPdfWhatsApp: Handler = async (req, res, next) => {
		try {
			const { serialNumber } = req.params;

			const result = await this.quoteService.getOne(serialNumber);
			if (result.status !== 200) {
				res.sendStatus(result.status);
				return;
			}

			const quote = result.quote;

			if (!quote.callingCode || !quote.phoneNumber) {
				res.status(400).json({
					message: 'El cliente no tiene número de teléfono registrado',
				});
				return;
			}

			const buffer = await this.docsService.generateQuote(serialNumber);
			const filename = `CTZ-${serialNumber}.pdf`;
			const mediaId = await this.waDocService.uploadMedia(buffer, filename);

			const customerName =
				(quote.fullName as string)?.toUpperCase() ?? 'CONSUMIDOR FINAL';
			const { total } = calculateTotals(quote);
			const templateParams = {
				customerName,
				serialNumber,
				total,
				docName: filename,
				templateName: 'send_quote',
			};

			const recipientPhone = `${quote.callingCode}${quote.phoneNumber}`;
			await this.waDocService.sendTemplate(
				recipientPhone,
				mediaId,
				templateParams,
			);

			// const shopPhone =
			// 	quote.countryIsoCode === 'CO'
			// 		? ENV.SHOP_CO_PHONE_NUMBER
			// 		: ENV.SHOP_EC_PHONE_NUMBER;

			// if (shopPhone) {
			// 	this.waDocService
			// 		.sendTemplate(shopPhone, mediaId, templateParams)
			// 		.catch((err) => console.error('Error sending WhatsApp to shop:', err.message));
			// }

			res.status(200).json({ message: 'PDF enviado correctamente' });
		} catch (error) {
			next(error);
		}
	};

	getBillingPdf: Handler = async (req, res, next) => {
		try {
			const { serialNumber } = req.params;

			const buffer = await this.docsService.generateBilling(serialNumber);

			res.set({
				'Content-Type': 'application/pdf',
				'Content-Disposition': `inline; filename="FCT-${serialNumber}.pdf"`,
				'Content-Length': buffer.length,
			});

			res.end(buffer);
		} catch (error) {
			next(error);
		}
	};

	sendBillingPdfWhatsApp: Handler = async (req, res, next) => {
		try {
			const { serialNumber } = req.params;

			const result = await this.billingService.getOne(serialNumber);
			if (result.status !== 200) {
				res.sendStatus(result.status);
				return;
			}

			const billing = result.billing;

			if (!billing.callingCode || !billing.phoneNumber) {
				res.status(400).json({
					message: 'El cliente no tiene número de teléfono registrado',
				});
				return;
			}

			const buffer = await this.docsService.generateBilling(serialNumber);
			const filename = `FCT-${serialNumber}.pdf`;
			const mediaId = await this.waDocService.uploadMedia(buffer, filename);

			const customerName =
				(billing.fullName as string)?.toUpperCase() ?? 'CONSUMIDOR FINAL';
			const { total } = calculateTotals(billing);
			const templateParams = {
				customerName,
				serialNumber,
				total,
				docName: filename,
				templateName: 'send_billing',
			};

			const recipientPhone = `${billing.callingCode}${billing.phoneNumber}`;
			await this.waDocService.sendTemplate(
				recipientPhone,
				mediaId,
				templateParams,
			);

			res.status(200).json({ message: 'PDF enviado correctamente' });
		} catch (error) {
			next(error);
		}
	};
}
