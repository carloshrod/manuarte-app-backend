import { Router } from 'express';
import { QuoteModel } from '../quote/model';
import { BillingModel } from '../billing/model';
import { DocsController } from './controller';
import { DocsService } from './service';
import { WhatsAppDocumentService } from '../whatsapp/document.service';
import { authorize } from '../../middlewares/authorize';
import { QuotePermissions, BillingPermissions } from '../permission/enums';
import { QuoteService } from '../quote/service';
import { BillingService } from '../billing/service';

const router = Router();

const quoteService = new QuoteService(QuoteModel);
const billingService = new BillingService(BillingModel);
const waDocService = new WhatsAppDocumentService();
const docsService = new DocsService(quoteService, billingService);

const docsController = new DocsController(
	docsService,
	quoteService,
	billingService,
	waDocService,
);

router.get(
	'/:serialNumber/quote-pdf',
	authorize(QuotePermissions.QUOTE_READ),
	docsController.getQuotePdf,
);
router.post(
	'/:serialNumber/send-quote-pdf',
	authorize(QuotePermissions.QUOTE_READ),
	docsController.sendQuotePdfWhatsApp,
);
router.get(
	'/:serialNumber/billing-pdf',
	authorize(BillingPermissions.BILLING_READ),
	docsController.getBillingPdf,
);
router.post(
	'/:serialNumber/send-billing-pdf',
	authorize(BillingPermissions.BILLING_READ),
	docsController.sendBillingPdfWhatsApp,
);

export default router;
