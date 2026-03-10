export function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // quitar tildes
		.replace(/[^a-z0-9\s]/g, '') // quitar caracteres especiales
		.trim();
}

export function stemTerm(word: string): string {
	if (word.length > 4 && word.endsWith('es')) return word.slice(0, -2);
	if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
	return word;
}

export function formatPrice(price: string | null, currency: string): string {
	if (!price) return 'precio no disponible';
	const num = Number(price);
	if (currency === 'COP') {
		return `$${num.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
	}
	return `$${num.toFixed(2)}`;
}
