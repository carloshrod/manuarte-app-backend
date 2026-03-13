import { WhatsAppMessageLogModel } from './message-log.model';
import { WhatsAppQueryLogModel } from './query-log.model';
import { WhatsAppErrorLogModel } from './error-log.model';

export class WhatsAppLogService {
	async logMessage(data: {
		phoneNumber: string;
		botPhoneNumberId: string;
		direction: 'inbound' | 'outbound';
		text: string;
		intent: string | null;
		countryPrefix: string | null;
	}) {
		await WhatsAppMessageLogModel.create({
			phoneNumber: data.phoneNumber,
			botPhoneNumberId: data.botPhoneNumberId,
			direction: data.direction,
			text: data.text,
			intent: data.intent,
			countryPrefix: data.countryPrefix,
		});
		console.log(
			`[WhatsAppLogService] Message log saved — direction: ${data.direction}, phone: ${data.phoneNumber}`,
		);
	}

	async logQuery(data: {
		phoneNumber: string;
		botPhoneNumberId: string;
		rawText: string;
		searchTerms: string[];
		productFound: boolean;
		suggestionsShown: boolean;
		replyText: string;
		countryPrefix: string | null;
	}) {
		await WhatsAppQueryLogModel.create({
			phoneNumber: data.phoneNumber,
			botPhoneNumberId: data.botPhoneNumberId,
			rawText: data.rawText,
			searchTerms: data.searchTerms,
			productFound: data.productFound,
			suggestionsShown: data.suggestionsShown,
			replyText: data.replyText,
			countryPrefix: data.countryPrefix,
		});
		console.log(
			`[WhatsAppLogService] Query log saved for ${data.phoneNumber} — found: ${data.productFound}, suggestions: ${data.suggestionsShown}`,
		);
	}

	async logError(data: {
		context: string;
		error: unknown;
		phoneNumber?: string;
		botPhoneNumberId?: string;
		rawText?: string;
	}) {
		const err =
			data.error instanceof Error ? data.error : new Error(String(data.error));
		await WhatsAppErrorLogModel.create({
			context: data.context,
			errorMessage: err.message,
			errorStack: err.stack ?? null,
			phoneNumber: data.phoneNumber ?? null,
			botPhoneNumberId: data.botPhoneNumberId ?? null,
			rawText: data.rawText ?? null,
		});
		console.error(
			`[WhatsAppLogService] Error log saved — context: ${data.context}`,
			err.message,
		);
	}
}
