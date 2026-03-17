export function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // quitar tildes
		.replace(/[^a-z0-9\s]/g, '') // quitar caracteres especiales
		.trim();
}

export function stemTerm(word: string): string {
	// Plurales españoles en -[aeiou]les: esenciales→esencial, naturales→natural
	if (word.length > 5) {
		if (
			word.endsWith('ales') ||
			word.endsWith('eles') ||
			word.endsWith('iles') ||
			word.endsWith('oles') ||
			word.endsWith('ules')
		) {
			return word.slice(0, -2);
		}
	}
	if (word.length > 3 && word.endsWith('s')) return word.slice(0, -1);
	return word;
}

/**
 * SYNONYM_REPLACEMENTS: términos que el cliente usa pero que NO aparecen en los nombres
 * de productos en BD. El término original se reemplaza por sus valores en la búsqueda.
 * Ejemplo: "esencias" → buscar "fragancia" (no buscar "esencia" en BD).
 */
export const SYNONYM_REPLACEMENTS: Record<string, string[]> = {
	// El cliente dice "esencias"/"perfume"/"aroma" pero en BD el producto es "fragancia"
	esencia: ['fragancia'],
	perfume: ['fragancia'],
	aroma: ['fragancia'],
};

export const SYNONYMS: Record<string, string[]> = {
	// Pabilos / Mechas — bidireccional: cada término expande al otro
	pabilo: ['mecha'],
	mecha: ['pabilo'],
	wick: ['mecha', 'pabilo'],

	btms: ['emulsionante', 'emulsificante', 'cetilico'],

	// Fragancias - expansión desde el término real en BD
	fragancia: ['esencia', 'perfume', 'aroma'],

	// Ceras
	soja: ['soya'],
	soya: ['soja'],
	parafina: ['cera'],
	cera: ['parafina', 'soya'],

	// Mantecas
	shea: ['manteca', 'karite'],
	karite: ['manteca'],
	cacao: ['manteca'],

	// Colorantes / Pigmentos / Micas
	colorante: ['pigmento', 'mica', 'tinte'],
	pigmento: ['colorante', 'mica'],
	mica: ['pigmento', 'colorante'],
	tinte: ['colorante', 'pigmento'],

	// Bases / Glicerina / Jabón
	jabon: ['glicerina', 'base'],
	glicerina: ['base'],
	base: ['glicerina'],

	// Envases / Recipientes
	recipiente: ['envase', 'frasco', 'tarro', 'vaso'],
	frasco: ['envase'],
	tarro: ['envase'],
	contenedor: ['envase'],

	// Preservantes / Conservantes
	conservante: ['preservante'],
	preservante: ['conservante'],

	// Tensioactivos / Surfactantes
	surfactante: ['tensioactivo'],
	tensioactivo: ['betaina', 'texapon'],
	betaina: ['tensioactivo'],
	texapon: ['tensioactivo'],

	// Emulsionantes
	emulsificante: ['emulsionante'],
	emulsionante: ['emulsificante', 'cetilico'],

	// Soda Cáustica / NaOH
	sosa: ['soda', 'caustica'],
	naoh: ['soda', 'caustica'],
	hidroxido: ['soda', 'caustica'],
	caustica: ['soda'],

	// Bolsas / Tulas / Empaques
	bolsa: ['tula'],
	tula: ['bolsa'],
	empaque: ['bolsa', 'tula', 'caja'],

	// Spray / Atomizador
	spray: ['atomizador'],
	atomizador: ['spray'],

	// Balanza
	bascula: ['balanza'],

	// Moldes
	silicona: ['molde'],
	forma: ['molde'],
};

export function formatPrice(price: string | null, currency: string): string {
	if (!price) return 'precio no disponible';
	const num = Number(price);
	if (currency === 'COP') {
		return `$${num.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
	}
	return `$${num.toFixed(2)}`;
}
