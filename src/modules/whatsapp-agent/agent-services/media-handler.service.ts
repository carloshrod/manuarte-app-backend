import { redis } from '../../../config/redis';
import { ENV } from '../../../config/env';
import { WhatsAppService } from '../../whatsapp/service';
import { QuoteService } from '../../quote/service';
import { CountryService } from './country.service';
import { SESSION_TTL_SECONDS } from '../constants';
import { formatPrice, isWithinOfficeHours } from '../utils';
import { PendingPurchaseFlow, UserSession } from '../types';

type SendReplyFn = (
	to: string,
	botPhoneNumberId: string,
	text: string,
) => Promise<void>;

export class MediaHandlerService {
	constructor(
		private countryService: CountryService,
		private quoteService: QuoteService,
		private whatsAppService: WhatsAppService,
		private sendReply: SendReplyFn,
	) {}

	handleIncomingImage = (
		phoneNumber: string,
		botPhoneNumberId: string,
		mediaId: string,
		mediaType: 'image' | 'document',
		processingQueue: Map<string, Promise<void>>,
	): Promise<void> => {
		const prev = processingQueue.get(phoneNumber);
		let resolveCurrent!: () => void;
		const current = new Promise<void>(resolve => {
			resolveCurrent = resolve;
		});
		processingQueue.set(phoneNumber, current);
		const run = async () => {
			if (prev) await prev;
			try {
				await this.doHandleIncomingImage(
					phoneNumber,
					botPhoneNumberId,
					mediaId,
					mediaType,
				);
			} finally {
				resolveCurrent();
				if (processingQueue.get(phoneNumber) === current) {
					processingQueue.delete(phoneNumber);
				}
			}
		};
		return run();
	};

	private doHandleIncomingImage = async (
		phoneNumber: string,
		botPhoneNumberId: string,
		mediaId: string,
		mediaType: 'image' | 'document',
	): Promise<void> => {
		const raw = await redis.get(`session:${phoneNumber}`);
		const session: UserSession = raw ? JSON.parse(raw) : {};

		const step = session.pendingPurchaseFlow?.step;
		if (
			step !== 'awaiting_receipt' &&
			step !== 'awaiting_payment_confirmation'
		) {
			// Media outside receipt flow: ignore silently
			console.log(
				`[WhatsApp Agent] Received media from ${phoneNumber} outside receipt flow, ignoring.`,
			);
			return;
		}

		const flow = session.pendingPurchaseFlow!;
		const countryInfo = await this.countryService.detectFromPhone(phoneNumber);
		const isoCode = countryInfo?.isoCode ?? 'CO';

		// Notify vendor with the attached receipt
		await this.notifyVendor(
			botPhoneNumberId,
			isoCode,
			flow,
			mediaId,
			mediaType,
		).catch(err =>
			console.error(
				'[WhatsApp Agent] Error notifying vendor with receipt:',
				err,
			),
		);

		// Clear flow and cart
		session.pendingPurchaseFlow = null;
		session.cart = [];

		await redis.set(
			`session:${phoneNumber}`,
			JSON.stringify(session),
			'EX',
			SESSION_TTL_SECONDS,
		);

		const offHoursNote = !isWithinOfficeHours()
			? '\n\n⏰ Nuestro equipo está fuera de horario ahora mismo (L–V 8–18h, Sáb 8–14h), pero recibirán su pedido y le contactarán a la brevedad.'
			: '';

		const reply =
			`✅ ¡Comprobante recibido! Nuestro equipo lo verificará y le confirmará el pedido en breve.` +
			offHoursNote +
			`\n\n¡Gracias por su compra! 🎉`;

		await this.sendReply(phoneNumber, botPhoneNumberId, reply);
	};

	private notifyVendor = async (
		botPhoneNumberId: string,
		isoCode: string,
		flow: PendingPurchaseFlow,
		receiptMediaId?: string,
		receiptMediaType?: 'image' | 'document',
	): Promise<void> => {
		const vendorPhone =
			isoCode === 'CO' ? ENV.SHOP_CO_PHONE_NUMBER : ENV.SHOP_EC_PHONE_NUMBER;

		if (!vendorPhone) {
			console.warn(
				`[WhatsApp Agent] No vendor phone configured for isoCode=${isoCode}`,
			);
			return;
		}

		const d = flow.collectedData ?? {};
		const itemLines =
			flow.items && flow.items.length > 0
				? flow.items
						.map(item => {
							const name = item.variantName
								? `${item.productName} – ${item.variantName}`
								: item.productName;
							return `  • ${item.quantity}x ${name}`;
						})
						.join('\n')
				: `• Revisar Cotización #${flow.quoteSerial}`;

		const totalLine =
			flow.total != null
				? `\nTotal: ${formatPrice(String(flow.total), flow.currency ?? 'USD')}`
				: '';

		const refLine = flow.paymentRef ? `\nRef pago: ${flow.paymentRef}` : '';
		const quoteRefLine =
			flow.purchaseFromQuote && flow.quoteSerial
				? `\nCotización: #${flow.quoteSerial}`
				: '';

		const message =
			`📦 *Nueva orden de compra*` +
			`\n\nCliente: ${d.fullName ?? '-'}` +
			`\nCédula: ${d.dni ?? '-'}` +
			`\nTeléfono: ${d.phoneNumber ?? '-'}` +
			`\nDirección: ${d.location ?? '-'}` +
			`\nCiudad: ${d.cityName ?? '-'}` +
			`\n\nProductos:\n${itemLines}` +
			totalLine +
			refLine +
			quoteRefLine +
			`\n\n✅ El cliente confirmó el pago. Por favor, verificar y procesar el pedido.`;

		if (receiptMediaId) {
			const sendMedia =
				receiptMediaType === 'document'
					? this.whatsAppService.sendDocument(
							vendorPhone,
							receiptMediaId,
							botPhoneNumberId,
							'comprobante.pdf',
							message,
						)
					: this.whatsAppService.sendImage(
							vendorPhone,
							receiptMediaId,
							botPhoneNumberId,
							message,
						);
			await sendMedia.catch(err =>
				console.error(
					'[WhatsApp Agent] Error forwarding receipt to vendor:',
					err,
				),
			);
		} else {
			await this.sendReply(vendorPhone, botPhoneNumberId, message);
		}
	};
}
