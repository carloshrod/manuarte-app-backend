import { ENV } from '../../../config/env';
import { ShopModel } from '../../shop/model';
import { StockModel } from '../../stock/model';
import { CountryModel } from '../../country/model';
import { WhatsAppLogService } from '../logging/log.service';

export type CountryContext = {
	currency: string;
	stockIds: string[];
	shopId: string;
	isoCode: string;
};

export class CountryService {
	constructor(private logService: WhatsAppLogService) {}

	detectFromPhone = async (
		phoneNumber: string,
	): Promise<CountryContext | null> => {
		try {
			// Detect callingCode from number (E.164 format without +)
			const prefixes = ['593', '57']; // Ecuador first (longer prefix)
			const matchedPrefix = prefixes.find(p => phoneNumber.startsWith(p));

			// ── TESTING BLOCK ──────────────────────────────────────────────────
			// TEST_FORCE_COUNTRY_ISO forces a specific country ignoring the phone
			// prefix. Allows testing Ecuador bot from Colombia.
			// ⚠️ Remove or leave as '' in production.
			const forcedIso = ENV.TEST_FORCE_COUNTRY_ISO?.toUpperCase();
			const effectivePrefix =
				forcedIso === 'EC' ? '593' : forcedIso === 'CO' ? '57' : matchedPrefix;
			// ── END TESTING BLOCK ──────────────────────────────────────────────

			if (!effectivePrefix) {
				console.warn(
					`[WhatsApp Agent] Unknown country prefix for ${phoneNumber}`,
				);
				return null;
			}

			// Resolve shop by country using slug (same convention as customer-balance)
			const shopSlug =
				effectivePrefix === '57' ? 'manuarte-barranquilla' : 'manuarte-quito';

			const shop = await ShopModel.findOne({
				where: { slug: shopSlug },
				attributes: ['id', 'currency'],
				include: [
					{
						model: StockModel,
						as: 'stock',
						attributes: ['id'],
					},
					{
						model: CountryModel,
						as: 'country',
						attributes: ['isoCode'],
					},
				],
			});

			if (!shop) return null;

			const stock = shop.get('stock') as { id: string } | null;
			const country = shop.get('country') as { isoCode: string } | null;
			const stockIds = stock ? [stock.id] : [];
			const currency = (shop.get('currency') as string | undefined) ?? 'USD';
			const isoCode =
				country?.isoCode ?? (effectivePrefix === '57' ? 'CO' : 'EC');

			console.log(
				`[WhatsApp Agent] Country detected: +${effectivePrefix}, currency: ${currency}, shop: ${shopSlug}, stocks: ${stockIds.join(', ')}`,
			);
			return { currency, stockIds, shopId: shop.id, isoCode };
		} catch (error) {
			console.error('[WhatsApp Agent] Error detecting country:', error);
			this.logService
				.logError({ context: 'detectCountryFromPhone', error, phoneNumber })
				.catch(e =>
					console.error('[WhatsApp Agent] Failed to save error log:', e),
				);
			return null;
		}
	};
}
