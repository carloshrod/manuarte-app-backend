import { format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { BillingStatus, DiscountType, PaymentMethod } from '../billing/types';

export { DiscountType };

// ─── Mapeos ─────────────────────────────────────────────────────────────────

export const BILLING_STATUS_MAP: Record<BillingStatus, string> = {
	[BillingStatus.PAID]: 'Pagado',
	[BillingStatus.PENDING_PAYMENT]: 'Pendiente de pago',
	[BillingStatus.PARTIAL_PAYMENT]: 'Abono parcial',
	[BillingStatus.PENDING_DELIVERY]: 'Pendiente de entrega',
	[BillingStatus.CANCELED]: 'Cancelado',
};

export const PAYMENT_METHOD_MAP: Record<PaymentMethod, string> = {
	[PaymentMethod.CASH]: 'Efectivo',
	[PaymentMethod.BANK_TRANSFER]: 'Transferencia bancaria',
	[PaymentMethod.BANK_TRANSFER_RT]: 'Transferencia bancaria RT',
	[PaymentMethod.BANK_TRANSFER_RBT]: 'Transferencia bancaria RBT',
	[PaymentMethod.DEBIT_CARD]: 'Tarjeta débito',
	[PaymentMethod.CREDIT_CARD]: 'Tarjeta crédito',
	[PaymentMethod.NEQUI]: 'Nequi',
	[PaymentMethod.BOLD]: 'Bold',
	[PaymentMethod.EFECTY]: 'Efecty',
	[PaymentMethod.WOMPI]: 'Wompi',
	[PaymentMethod.PAYPHONE]: 'Payphone',
	[PaymentMethod.PAYPAL]: 'PayPal',
	[PaymentMethod.BANK_DEPOSIT]: 'Depósito bancario',
	[PaymentMethod.BALANCE]: 'Saldo a favor',
	[PaymentMethod.OTHER]: 'Otro',
};

// ─── Formatters ──────────────────────────────────────────────────────────────

const units = new Set(['cc', 'kg', 'mm', 'cm', 'm', 'l', 'ml']);

export const formatToTitleCase = (str: string): string | null => {
	if (!str) return null;

	const isUnit = (word: string) => units.has(word.toLowerCase());

	if (!/\s/.test(str)) {
		if (isUnit(str)) return str.toLowerCase();
		return `${str.charAt(0).toUpperCase()}${str.slice(1).toLowerCase()}`;
	}

	return str
		.split(' ')
		.map(word =>
			isUnit(word)
				? word.toLowerCase()
				: `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`,
		)
		.join(' ');
};

export const formatCurrency = (amount: number | string): string => {
	const currency = Number(amount);
	if (isNaN(currency)) return 'Invalid number';

	const [integerPart, decimalPart] = currency.toFixed(2).toString().split('.');

	const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

	return decimalPart && +decimalPart > 0
		? `$${formattedInteger},${decimalPart.padEnd(2, '0')}`
		: `$${formattedInteger}`;
};

export const formatDate = (
	date: Date | string,
	showTime: boolean = false,
): string => {
	try {
		if (!date) return '--';

		const d = new Date(date);

		if (showTime) {
			return format(d, 'dd-MMM-yyyy, h:mm a', { locale: es }).toUpperCase();
		}

		return format(startOfDay(d), 'dd-MMM-yyyy', { locale: es }).toUpperCase();
	} catch {
		return '--';
	}
};

// ─── Totals ──────────────────────────────────────────────────────────────────

type TotalsInput = {
	items?: Array<{ totalPrice: number | string }>;
	discountType?: DiscountType | null;
	discount?: number | string | null;
	shipping?: number | string | null;
};

export const calculateTotals = (data: TotalsInput) => {
	const items = data?.items ?? [];
	const discountType = data?.discountType;
	const discount = data?.discount;
	const shipping = data?.shipping;

	const subtotal = items.reduce(
		(acc, item) => acc + Number(item.totalPrice),
		0,
	);

	const isFixedDiscount = !discountType || discountType === DiscountType.FIXED;

	const discountLabel = isFixedDiscount
		? 'DESCUENTO'
		: `DESCUENTO (${discount}%)`;

	const discountValue = isFixedDiscount
		? Number(discount) || 0
		: subtotal * (Number(discount) / 100) || 0;

	const total = subtotal - discountValue + Number(shipping ?? 0);

	return { subtotal, discountValue, discountLabel, total };
};
