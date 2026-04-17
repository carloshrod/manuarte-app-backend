import OpenAI from 'openai';
import { ENV } from '../../config/env';
import { formatPrice } from './utils';

const SYSTEM_PROMPT = `
Eres Gema, asesora de ventas de Manuarte.

Tu objetivo es ayudar al cliente a encontrar productos, resolver dudas y guiarlo hacia una compra de forma natural y cercana.

ESTILO DE COMUNICACIÓN:
- Habla siempre en español.
- Usa un tono natural, amigable y profesional.
- Escribe como una persona real, no como un sistema.
- Usa frases cortas y claras.
- Evita lenguaje técnico o robótico.
- No uses formato markdown (sin asteriscos, sin guiones para listas, sin negrillas). El texto debe quedar limpio.
- Evita expresiones que suenan artificiales o repetitivas como "Genial".
- Puedes empezar la respuesta con palabras como "Perfecto", "Vale", "Claro", "Listo", "Dale", o continuar directamente sin muletillas si suena más natural.
- No inicies cada mensaje con un saludo.
- No digas "Hola" ni te presentes nuevamente si la conversación ya está en curso.
- Solo saluda cuando sea el primer mensaje o cuando el cliente salude después de mucho tiempo.

SALUDO INICIAL:
- En el primer saludo, NO menciones el giro de la tienda ni detalles sobre productos (velas, jabones, insumos, etc.).
- El cliente ya sabe a qué se dedica Manuarte.
- Haz el saludo sencillo, sin detalles sobre productos o la tienda. Solo menciona tu nombre.
- Dependiendo de la hora del día (horario Colombia o Ecuador), puedes usar saludos como "buenos días", "buenas tardes" o "buenas noches" de forma natural, pero no es obligatorio.
- Ejemplos válidos: "Hola soy Gema, ¿en qué te puedo ayudar?", "Hola, soy Gema ¿qué se te ofrece el día hoy?", "Buenos días, soy Gema ¿cómo puedo ayudarte?". No te limites a un solo formato, varía tus saludos para que suenen naturales.
- No digas frases como "¿Qué producto o insumo estás buscando para la fabricación de velas o jabones?" ni variantes.
- Solo menciona detalles de la tienda o productos si el cliente lo pregunta explícitamente.

EMOJIS:
- Usa emojis con moderación: máximo 1 por mensaje y no en todos los mensajes.
- Varía los emojis según el contexto: puede ser 👋, ✨, 🕯️, 🧴, 💛, 👌, 🙌, etc.
- Nunca uses 😊 de forma repetitiva ni lo pongas como cierre automático de cada mensaje.
- Si el mensaje es informativo o de seguimiento, omite el emoji.

REGLAS IMPORTANTES:
- Nunca menciones que eres un bot o una IA.
- Nunca inventes productos, precios o disponibilidad.
- Usa únicamente la información que se te proporcione.
- Si no tienes suficiente información, pide más detalles de forma natural.
- No repitas siempre las mismas frases.
- Evita estructuras rígidas tipo sistema.
- Prioriza fluidez sobre formalidad.
- Si una frase suena como interfaz o software, reescríbela de forma conversacional.

COMPORTAMIENTO:
- Siempre intenta entender qué necesita el cliente.
- Da respuestas útiles, no solo informativas.
- Después de responder, guía la conversación con una pregunta.
- Adapta tus respuestas según lo que diga el cliente.

CUANDO HAY PRODUCTOS:
-No uses asteriscos ni markdown para resaltar.
-No agregues información descriptiva ni promocional que no se haya pedido. Nombre, precio y cantidad: nada más.
-Si hay UN SOLO producto con UNA SOLA variante, no hagas lista: preséntalo en una frase breve y directa. Ejemplo: "Tenemos [nombre] a [precio] ([X] disponibles)." No añadas descripciones, ventajas ni texto de relleno. Usa preguntas en singular: "¿Te interesa?" o "¿Quieres llevarlo?".
-Si un producto tiene VARIAS variantes, muéstralas SIEMPRE como sub-ítems bajo el nombre del producto, NUNCA como ítems numerados separados. Formato obligatorio:
	Nombre del producto:
	- Variante 1 – precio (X disponibles)
	- Variante 2 – precio (X disponibles)
	CRÍTICO: NUNCA pongas cada variante como "1. Nombre – precio" y "2. Nombre – precio". Las variantes del MISMO producto van con guion (-), no numeradas.
-Si hay VARIOS productos distintos, preséntalos en lista numerada:
	1. Nombre – precio (X disponibles)
	2. Nombre – precio (X disponibles)
-Si hay VARIOS productos, haz una sola pregunta directa para que el cliente elija, por ejemplo: "¿Cuál te interesa?" o "¿Cuál deseas llevar?".
-No preguntes si quiere saber más sobre los productos ni des opciones para preguntar.
-Guía siempre hacia la elección y cotización.
-Usa preguntas directas y simples.
-Evita frases largas antes de la pregunta.
-No des conclusiones como "ambos son excelentes" si no aportan a la decisión.

CUANDO EL CLIENTE ELIGE UN PRODUCTO:
- Nunca uses frases como:
  "Has elegido", "Seleccionaste", "Has seleccionado", "Elegiste"
- Nunca anuncies la selección como si fuera un sistema.
- Responde como si ya estuvieran hablando naturalmente del producto.
- Empieza la respuesta de forma natural, por ejemplo:
  "Perfecto", "Vale", "Claro", "Genial", o directamente con la explicación.
- Menciona el nombre del producto dentro de la explicación de forma natural.
- No lo presentes como título ni como selección confirmada.
- Ejemplo correcto: "La cera de soja es ideal..." en lugar de "Has elegido la cera de soja".
- CRÍTICO: Usa ÚNICAMENTE los datos de nombre, variante, precio y disponibilidad que se te proporcionen. NUNCA inventes ni uses datos de tu entrenamiento (presentaciones, gramajes, precios, cantidades). Si el dato no está en el contexto, no lo menciones.
- Invita a continuar, pero NUNCA ofrezcas hacer una cotización a menos que el cliente lo pida explícitamente.
- Haz solo UNA pregunta al final.
- La pregunta debe ser corta, clara y directa.
- Evita preguntas dobles o largas.
- No hagas preguntas abiertas después de mostrar un producto.
- No preguntes si quiere más información.
- Asume intención de compra y guía hacia cantidad o siguiente paso.

CUANDO EL CLIENTE INDICA UNA CANTIDAD:
- Confirma la cantidad de forma natural incluyendo: cantidad, nombre del producto, variante, precio unitario y total.
- Varía la frase inicial cada vez. Ejemplos: "Listo, serían...", "Perfecto, serían...", "Dale, van...", "Vale, serían...", "Claro, serían...". No repitas siempre la misma.
- Si no tienes el precio, confirma solo la cantidad y el nombre.
- Después de la confirmación, agrega SOLO UNA pregunta corta como "¿Necesitas algo más?" o "¿Quieres continuar con el pedido?"
- PROHIBIDO usar frases como: "Puedo reservarte", "hay cantidades suficientes", "sin problema", "Es una excelente opción", "con gusto".
- NO añadas comentarios sobre el producto ni frases de cortesía adicionales.

- No siempre empieces con "La [producto]..."
- A veces puedes usar:
  - "Es una..."
  - "Te sirve mucho para..."
  - "Funciona muy bien para..."
- Pero asegúrate de que el producto quede claro en el mensaje.

CUANDO HAY OBJECIONES:
- Si el cliente dice que está caro, ofrece una presentación más pequeña o más económica, SOLO si existe y está disponible. Nunca inventes productos, precios o disponibilidad.
- Si dice que lo va a pensar, que después o que te avisa, despídete con calidez y deja la puerta abierta.
- Nunca presiones ni repitas el precio.
- Sé breve y humano.
- Ejemplo espera: "Sin problema, aquí estoy cuando lo necesites."

CUANDO NO ENCUENTRES LO QUE BUSCA:
- No digas simplemente "no encontrado".
- Responde de forma natural.
- Pide más detalles o reformula la pregunta.

VENTA (MUY IMPORTANTE):
- Si puedes, haz preguntas para entender mejor:
  - ¿Para qué lo vas a usar?
  - ¿Buscas algo económico o de mejor calidad?
- Sugiere ayuda sin ser insistente.

CONTEXTO:
- Si el cliente ya estaba hablando de un producto, tenlo en cuenta.
- Si el cliente hace preguntas cortas ("precio?", "tienes más barato?"), interpreta el contexto.

OBJETIVO FINAL:
- Que el cliente sienta que está hablando con una persona real.
- Generar confianza.
- Facilitar la compra.
`;

export interface OpenAIProductVariant {
	name: string;
	totalQty: number;
	price: string | null;
}

export interface OpenAIProduct {
	name: string;
	description?: string;
	variants: OpenAIProductVariant[];
}

export interface OpenAICartItem {
	productName: string;
	variantName?: string;
	quantity: number;
	unitPrice: string | null;
	currency: string;
}

export interface OpenAIContext {
	userMessage: string;
	products?: OpenAIProduct[];
	hasMoreProducts?: boolean;
	isShowingMore?: boolean;
	selectedProduct?: OpenAIProduct;
	selectedProducts?: OpenAIProduct[];
	resumptionProduct?: OpenAIProduct;
	currency?: string;
	isFirstInteraction?: boolean;
	intent?: string;
	lastBotMessage?: string;
	quantity?: number;
	cart?: OpenAICartItem[];
	outOfStockProductName?: string;
	/** Producto removido del carrito (para edit_cart) */
	removedProduct?: string;
	/** Producto agregado/actualizado en carrito (para edit_cart) */
	addedProduct?: OpenAIProduct;
	addedQuantity?: number;
	/** Cantidad que el cliente pidió originalmente (antes de limitar al stock) */
	requestedQuantity?: number;
	/** Nota personalizada de stock excedido (reemplaza el mensaje genérico cuando las unidades no representan la cantidad que el cliente entiende) */
	stockExceededNote?: string;
	/** Datos recopilados del cliente en flujo de cotización */
	quoteFlowData?: {
		fullName?: string;
		dni?: string;
		phoneNumber?: string;
		location?: string;
		cityName?: string;
	};
	/** Candidatos de ciudad para selección */
	cityCandidates?: Array<{ index: number; name: string; region: string }>;
	/** Número de serie de cotización creada */
	quoteSerialNumber?: string;
}

export type AIDetectedIntent =
	| 'select_product'
	| 'search_product'
	| 'show_more'
	| 'show_cart'
	| 'edit_cart'
	| 'request_quote'
	| 'greeting'
	| 'objection'
	| 'general_question'
	| 'unknown';

export interface AIIntentResult {
	intent: AIDetectedIntent;
	searchQuery?: string;
	selectionIndexes?: number[];
	variantHint?: string;
	quantity?: number;
	/** Cantidades por producto cuando se seleccionan varios; paralelo a selectionIndexes */
	quantities?: number[];
	/** Fragmento del nombre del producto a ELIMINAR del carrito */
	removeProductHint?: string;
	/** Fragmento del nombre del producto a AGREGAR/ACTUALIZAR en cantidad */
	addProductHint?: string;
	/** Para actualizaciones de DOS O MÁS productos simultáneamente en el carrito */
	cartEdits?: Array<{ productHint: string; quantity: number }>;
}

export class OpenAIService {
	private client: OpenAI;

	constructor() {
		this.client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
	}

	generateReply = async (ctx: OpenAIContext): Promise<string> => {
		const userContent = this.buildUserContent(ctx);

		const response = await this.client.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{ role: 'system', content: SYSTEM_PROMPT },
				{ role: 'user', content: userContent },
			],
			max_tokens: 400,
			temperature: 0.6,
		});

		return response.choices[0]?.message?.content?.trim() ?? '';
	};

	detectIntentWithAI = async (
		text: string,
		hasActiveProductList: boolean,
		activeProducts?: Array<{ index: number; label: string }>,
		awaitingMoreProducts?: boolean,
		currentSelectedProduct?: string,
		cart?: OpenAICartItem[],
	): Promise<AIIntentResult> => {
		const selectedProductNote = currentSelectedProduct
			? `\nNota: el cliente tiene actualmente seleccionado el producto "${currentSelectedProduct}". Si el mensaje menciona EXPLÍCITAMENTE el nombre de otro producto de la lista, clasifícalo como "select_product". Si el mensaje es SOLO un número sin más contexto, probablemente es una cantidad para el producto ya seleccionado (clasifícalo como "unknown" con quantity).\n`
			: '';
		const productListSection =
			activeProducts && activeProducts.length > 0
				? `\nEl cliente tiene esta lista de productos activa:\n${activeProducts.map(p => `${p.index}. ${p.label}`).join('\n')}\n`
				: hasActiveProductList
					? '\nNota: el cliente tiene una lista de productos activa en la conversación.'
					: '';

		const showMoreNote = awaitingMoreProducts
			? '\nNota: hay más productos disponibles que no se le han mostrado al cliente todavía.\n'
			: '';

		const cartNote =
			cart && cart.length > 0
				? `\nEl cliente tiene estos productos en su pedido actual:\n${cart
						.map(item => {
							const name = item.variantName
								? `${item.productName} ${item.variantName}`
								: item.productName;
							return `- ${item.quantity}x ${name}`;
						})
						.join(
							'\n',
						)}\nSi el mensaje menciona cambiar cantidad, eliminar o modificar alguno de esos productos → clasifica como "edit_cart". IMPORTANTE: si el mensaje contiene verbos como "agrega", "añade", "suma", "quita", "saca" + nombre de un producto del pedido → es SIEMPRE "edit_cart", aunque haya una lista de productos activa con números.\n`
				: '';

		const selectionInstructions =
			activeProducts && activeProducts.length > 0
				? `  - "select_product": el cliente elige uno o más productos de la lista activa (por número, nombre completo o fragmento del nombre). IMPORTANTE: si el cliente menciona una palabra o fragmento que coincide con cualquier parte del nombre de un producto de la lista (ej: "tr plus" coincide con "BASE DE GLICERINA EASY SOAP TR PLUS-TRANSPARENTE KILO"), clasifícalo como "select_product", NO como "search_product".\n`
				: '';

		const showMoreInstruction =
			hasActiveProductList || (activeProducts && activeProducts.length > 0)
				? `  - "show_more": el cliente pregunta si hay más opciones, más productos, más variantes, o pide ver más (incluyendo frases negativas como "¿no tienen más?", "¿no hay más?", "¿solo eso tienen?", "¿solo tienes esa?", "¿nada más?", "¿no tienes otra?"). IMPORTANTE: si el cliente dice "tienes más [nombre de producto]" (ej: "tienes más mechas"), clasifícalo como "search_product", no "show_more".\n`
				: '';

		const systemPrompt = `Eres un clasificador de intents para un chatbot de ventas.${selectedProductNote}${productListSection}${showMoreNote}${cartNote}
Analiza el mensaje del cliente y devuelve un JSON con:
- "intent": uno de estos valores exactos:
${selectionInstructions}${showMoreInstruction}  - "show_cart": el cliente pregunta por el resumen de su pedido, lo que lleva, el total, cuánto es todo, cuánto sería por todo, cuánto suma lo que lleva, o cualquier variante de solicitar el detalle o precio total de su pedido actual
  - "search_product": el cliente busca un producto que NO está en la lista actual, o pregunta por precio/disponibilidad de algo nuevo
  - "edit_cart": el cliente quiere MODIFICAR su pedido actual: eliminar un producto, cambiar cantidad de uno ya agregado, o reemplazar uno por otro
  - "request_quote": el cliente pide una cotización, presupuesto, proforma, o quiere que le armen/generen/envíen una cotización con lo que lleva o ha pedido
  - "objection": el cliente dice que está caro, que lo va a pensar, que después, que no tiene dinero, que no le interesa
  - "greeting": saludo puro sin consulta de producto ni pregunta específica
  - "general_question": pregunta sobre envíos, métodos de pago, tiempo de entrega, políticas, u otras preguntas que no son sobre un producto específico en catálogo
  - "unknown": no se puede clasificar con certeza
${activeProducts && activeProducts.length > 0 ? '- "selectionIndexes": array de números 1-based SOLO si intent es "select_product". Puede ser uno o varios. Ej: [1] o [1,3]\n- "variantHint": SOLO si intent es "select_product" y el producto elegido tiene múltiples variantes y el cliente menciona una variante específica. Extrae el fragmento del nombre de la variante mencionada. Ej: "quiero la apf" → variantHint: "apf"\n- "quantities": array de números SOLO si intent es "select_product" y el cliente menciona una cantidad distinta para cada producto. Misma longitud y orden que selectionIndexes. Ej: "3 de chicle y 2 de floral" con selectionIndexes:[2,3] → quantities:[3,2]. Si todos los productos tienen la misma cantidad o no hay cantidad, omite este campo y usa "quantity".\n' : ''}- "quantity": número entero SOLO si el cliente menciona UNA sola cantidad que aplica a todos los productos seleccionados, o a cualquier otro intent. Ej: "dame 5", "quiero 3 kilos" → quantity: 5 o 3. No usar junto a "quantities".
- "removeProductHint": SOLO si intent es "edit_cart" Y el cliente pide EXPLÍCITAMENTE quitar/eliminar un producto (frases como "ya no quiero", "quita", "saca", "elimina", "sin"). NO usar si el cliente solo cambia la cantidad. Ej: "ya no quiero la mecha 8D" → removeProductHint: "mecha 8D". "que sean mejor 2 kilos de ácido esteárico" → NO removeProductHint (solo addProductHint con la nueva cantidad).
- "addProductHint": SOLO si intent es "edit_cart" Y el cliente modifica UN SOLO producto. Usa el fragmento MÁS ESPECÍFICO: las palabras que diferencian ese producto de otros en el pedido. Si hay varios productos del mismo tipo, DEBES incluir las palabras distintivas. Ej: "agrega 2 fragancias más de brisa marina" → addProductHint: "brisa marina" (NO "fragancia"). "agrega 1 kilo más de cera de coco" → addProductHint: "cera de coco"
- "cartEdits": SOLO si intent es "edit_cart" Y el cliente modifica DOS O MÁS productos del carrito en un mismo mensaje. Array de objetos {productHint, quantity}. No usar junto con addProductHint. Ej: "deben ser 4 de jazmin y 4 de brisa marina" → cartEdits: [{"productHint":"jazmin","quantity":4},{"productHint":"brisa marina","quantity":4}]
- "variantHint": TAMBIÉN para intent "search_product", si el cliente menciona una presentación, tamaño o formato específico del producto buscado (ej: "20 ml", "100 gramos", "1 litro", "medio kilo"). Extrae SOLO el fragmento de tamaño/presentación. Ej: "3 fragancias de chicle de 20 ml" → variantHint: "20 ml", "2 fragancias lavanda de 100 gramos" → variantHint: "100 gramos". No incluir si no hay presentación específica.
- "searchQuery": SOLO si intent es "search_product" Y el producto mencionado NO aparece en la lista activa. Extrae el nombre específico del producto incluyendo su descriptor propio (sabor, aroma, nombre de marca, tipo). Conserva "para velas" o "para jabones" si pueden ser parte del nombre del producto (hay productos exclusivos para uno u otro). Elimina SOLO frases de contexto de uso del cliente como "para hacer X", "para mis X", "para fabricar X", "para uso en X". Ejemplos: "fragancias para jabones" → "fragancia para jabones", "fragancia de chicle de 20 ml" → "fragancia chicle", "fragancia de lavanda para velas" → "fragancia lavanda para velas", "colorante para mis velas artesanales" → "colorante", "cera para hacer velas" → "cera", "3 kilos de cera de soya apf" → "cera soya apf".

Responde ÚNICAMENTE con el JSON, sin texto adicional.${activeProducts && activeProducts.length > 0 ? '\nEjemplos:\n{"intent":"select_product","selectionIndexes":[2]}\n{"intent":"select_product","selectionIndexes":[1,3]}\n{"intent":"select_product","selectionIndexes":[1],"quantity":5}\n{"intent":"select_product","selectionIndexes":[2],"variantHint":"apf","quantity":2}\n{"intent":"select_product","selectionIndexes":[1]}  // cliente dice "la tr plus" y el producto 1 contiene "TR PLUS" en su nombre\n{"intent":"select_product","selectionIndexes":[2,3],"quantities":[3,2]}  // cliente dice "3 de chicle y 2 de floral"\n{"intent":"edit_cart","removeProductHint":"mecha 8D"}\n{"intent":"edit_cart","addProductHint":"cera de coco","quantity":1}\n{"intent":"edit_cart","cartEdits":[{"productHint":"jazmin","quantity":4},{"productHint":"brisa marina","quantity":4}]}\n{"intent":"unknown","quantity":3}' : '\nEjemplo: {"intent":"search_product","searchQuery":"cera de soja"}'}${awaitingMoreProducts ? '\n{"intent":"show_more"}' : ''}`;
		const response = await this.client.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{ role: 'system', content: systemPrompt },
				{ role: 'user', content: text },
			],
			max_tokens: 150,
			temperature: 0,
			response_format: { type: 'json_object' },
		});

		const raw = response.choices[0]?.message?.content?.trim() ?? '{}';
		const parsed = JSON.parse(raw) as {
			intent?: string;
			searchQuery?: string;
			selectionIndexes?: unknown;
			variantHint?: unknown;
			quantity?: unknown;
			quantities?: unknown;
			removeProductHint?: unknown;
			addProductHint?: unknown;
			cartEdits?: unknown;
		};

		const validIntents: AIDetectedIntent[] = [
			'select_product',
			'search_product',
			'show_more',
			'show_cart',
			'edit_cart',
			'request_quote',
			'greeting',
			'objection',
			'general_question',
			'unknown',
		];
		const intent: AIDetectedIntent = validIntents.includes(
			parsed.intent as AIDetectedIntent,
		)
			? (parsed.intent as AIDetectedIntent)
			: 'unknown';

		const selectionIndexes: number[] | undefined =
			intent === 'select_product' && Array.isArray(parsed.selectionIndexes)
				? (parsed.selectionIndexes as unknown[])
						.map(Number)
						.filter(n => Number.isInteger(n) && n > 0)
				: undefined;

		const quantity: number | undefined =
			typeof parsed.quantity === 'number' && parsed.quantity > 0
				? parsed.quantity
				: undefined;

		const quantities: number[] | undefined =
			intent === 'select_product' && Array.isArray(parsed.quantities)
				? (parsed.quantities as unknown[])
						.map(Number)
						.filter(n => Number.isInteger(n) && n > 0)
				: undefined;

		return {
			intent,
			searchQuery:
				intent === 'search_product' && parsed.searchQuery
					? String(parsed.searchQuery)
					: undefined,
			selectionIndexes,
			variantHint:
				(intent === 'select_product' || intent === 'search_product') &&
				parsed.variantHint
					? String(parsed.variantHint)
					: undefined,
			quantity,
			quantities,
			removeProductHint:
				intent === 'edit_cart' && parsed.removeProductHint
					? String(parsed.removeProductHint)
					: undefined,
			addProductHint:
				intent === 'edit_cart' && parsed.addProductHint
					? String(parsed.addProductHint)
					: undefined,
			cartEdits:
				intent === 'edit_cart' && Array.isArray(parsed.cartEdits)
					? (parsed.cartEdits as unknown[]).filter(
							(e): e is { productHint: string; quantity: number } =>
								typeof e === 'object' &&
								e !== null &&
								typeof (e as Record<string, unknown>).productHint ===
									'string' &&
								typeof (e as Record<string, unknown>).quantity === 'number' &&
								(e as { quantity: number }).quantity > 0,
						)
					: undefined,
		};
	};

	private buildUserContent = (ctx: OpenAIContext): string => {
		const parts: string[] = [`Cliente: ${ctx.userMessage}`];
		const currency = ctx.currency ?? 'COP';

		const isGenericGreeting = /^(hola|buenas|hey|holi|ola)$/i.test(
			ctx.userMessage.trim(),
		);

		if (ctx.isFirstInteraction) {
			if (ctx.products && ctx.products.length > 0) {
				parts.push(
					'\nEs el primer mensaje del cliente e incluye tanto un saludo como una consulta de producto. Responde en un ÚNICO mensaje: empieza con una presentación muy breve de una sola línea (solo tu nombre, sin detalles de productos ni de la tienda), y a continuación muestra los productos directamente. No hagas el saludo y los productos como bloques separados.',
				);
			} else {
				parts.push(
					'\nEs la primera vez que este cliente escribe. Haz un saludo sencillo, sin mencionar productos ni el giro de la tienda. No des explicaciones largas sobre tu rol.',
				);
			}
		} else {
			parts.push(
				'\nLa conversación ya está en curso. No saludes ni te presentes nuevamente. Continúa de forma directa.',
			);
		}

		if (ctx.intent === 'objection') {
			if (ctx.selectedProduct) {
				const p = ctx.selectedProduct;
				const variantDetails = p.variants
					.map(
						v =>
							`  - ${v.name}: ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`,
					)
					.join('\n');
				parts.push(
					`\nProducto sobre el que hay objeción:\nNombre: ${p.name}` +
						(p.description ? `\nDescripción: ${p.description}` : '') +
						`\nVariantes disponibles:\n${variantDetails}`,
				);
			}
			if (ctx.products && ctx.products.length > 0) {
				const productList = ctx.products
					.map((p, i) => {
						if (p.variants.length === 1) {
							const v = p.variants[0];
							const label = v.name
								? `${p.name} ${v.name}`
								: p.description
									? `${p.name} (${p.description})`
									: p.name;
							return `${i + 1}. ${label} – ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`;
						}
						const variantLines = p.variants
							.map((v, idx) => {
								const varLabel = v.name || `Opción ${idx + 1}`;
								return `  - ${varLabel}: ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`;
							})
							.join('\n');
						return `${i + 1}. ${p.name}\n${variantLines}`;
					})
					.join('\n');
				parts.push(
					`\nProductos disponibles en la conversación (solo estos existen, no inventes otros):\n${productList}`,
				);
			}
			parts.push(
				'\nEl cliente tiene una objeción de precio o dudas. Responde con empatía y de forma breve.' +
					'\nSi el producto tiene variantes más pequeñas o económicas en la lista anterior, preséntaselas directamente sin preguntar si quiere verlas. No inventes productos, precios o disponibilidad.' +
					'\nSi hay otros productos más económicos en la lista, mencionarlos directamente.' +
					'\nSi no hay alternativas disponibles y el cliente solo quiere pensarlo o esperar, despídete con calidez y deja la puerta abierta.' +
					'\nNunca presiones, nunca repitas el precio completo, nunca inventes productos o presentaciones que no estén en la lista.',
			);
		} else if (ctx.intent === 'affirmation') {
			if (ctx.lastBotMessage) {
				parts.push(
					`\nAntes de que el cliente respondiera, tú habías dicho: "${ctx.lastBotMessage}"`,
				);
				parts.push(
					'\nEl cliente está confirmando o dando su acuerdo. Interpreta qué preguntaste en tu mensaje anterior y continúa de forma natural en consecuencia. No preguntes qué quiso decir ni pidas aclaración.',
				);
			}
			if (ctx.products && ctx.products.length > 0) {
				const productList = ctx.products
					.map((p, i) => {
						if (p.variants.length === 1) {
							const v = p.variants[0];
							const label = v.name
								? `${p.name} ${v.name}`
								: p.description
									? `${p.name} (${p.description})`
									: p.name;
							return `${i + 1}. ${label} – ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`;
						}
						const variantLines = p.variants
							.map((v, idx) => {
								const varLabel = v.name || `Opción ${idx + 1}`;
								return `  - ${varLabel}: ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`;
							})
							.join('\n');
						return `${i + 1}. ${p.name}\n${variantLines}`;
					})
					.join('\n');
				parts.push(
					`\nProductos disponibles en la conversación actual (usa si son relevantes para continuar):\n${productList}`,
				);
			}
		} else if (ctx.selectedProducts && ctx.selectedProducts.length > 1) {
			// Múltiples productos seleccionados
			const productList = ctx.selectedProducts
				.map((p, i) => {
					const variantDetails = p.variants
						.map(
							v =>
								`  - ${v.name}: ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`,
						)
						.join('\n');
					return (
						`${i + 1}. ${p.name}` +
						(p.description ? ` — ${p.description}` : '') +
						`\n${variantDetails}`
					);
				})
				.join('\n');
			parts.push(
				`\nEl cliente seleccionó múltiples productos:\n${productList}\n` +
					(ctx.quantity
						? `\nEl cliente mencionó una cantidad de ${ctx.quantity} unidades.`
						: '') +
					'\nPreséntalos brevemente de forma natural, menciona precios y disponibilidad, y pregunta cómo quiere continuar.',
			);
			parts.push(
				'\nNo anuncies la selección como sistema. Integra los productos de forma conversacional.',
			);
		} else if (ctx.selectedProduct) {
			const p = ctx.selectedProduct;
			const totalQty = p.variants.reduce((sum, v) => sum + v.totalQty, 0);
			const variantDetails = p.variants
				.map(
					v =>
						`  - ${v.name}: ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`,
				)
				.join('\n');
			if (ctx.quantity) {
				const singleVariant =
					p.variants.length === 1 ? p.variants[0] : undefined;
				const unitPriceNum = singleVariant?.price
					? parseFloat(singleVariant.price)
					: null;
				const totalPriceNum =
					unitPriceNum !== null ? unitPriceNum * ctx.quantity : null;
				const formattedUnit = singleVariant
					? formatPrice(singleVariant.price, currency)
					: null;
				const formattedTotal =
					totalPriceNum !== null
						? formatPrice(totalPriceNum.toString(), currency)
						: null;
				const productLabel = singleVariant?.name
					? `${p.name} ${singleVariant.name}`
					: p.name;
				const isStockExceeded =
					(ctx.requestedQuantity !== undefined &&
						ctx.requestedQuantity > (ctx.quantity ?? 0)) ||
					!!ctx.stockExceededNote;
				if (isStockExceeded) {
					// Stock insuficiente: incluir datos del producto + nota de stock
					const stockNote =
						ctx.stockExceededNote ??
						`El cliente pidió ${ctx.requestedQuantity} unidades pero solo hay ${ctx.quantity} disponible(s). NO confirmes el pedido ni calcules total. Informa brevemente que solo hay ${ctx.quantity} disponible(s) y pregunta si quiere esa cantidad, por ejemplo: "Solo tenemos ${ctx.quantity}, ¿te agrego esa?" o "Solo hay ${ctx.quantity} disponible, ¿quieres esa?" u otra variación natural. NUNCA uses frases como "te lo llevo", "te la llevo" ni similares.`;
					parts.push(
						`\nProducto: ${productLabel} a ${formattedUnit ?? 'precio no disponible'}.` +
							`\nIMPORTANTE: ${stockNote}`,
					);
				} else if (formattedUnit && formattedTotal) {
					// Confirmación limpia: NO incluir DATO EXACTO para evitar que el AI
					// mezcle info de disponibilidad con la confirmación
					parts.push(
						`\nResponde SOLO con este contenido: confirma que van ${ctx.quantity} unidades de ${productLabel} a ${formattedUnit} cada una, total ${formattedTotal}. Varía la frase inicial (usa "Listo", "Perfecto", "Dale", "Vale" u otra). Termina con UNA sola pregunta corta: "¿Necesitas algo más?" o "¿Quieres continuar con el pedido?". NO menciones disponibilidad, NO preguntes cuántas quiere, NO añadas nada más.`,
					);
				} else {
					parts.push(
						`\nEl cliente quiere ${ctx.quantity} unidades de ${productLabel}. Confirma en UNA frase corta. No uses frases como "Puedo reservarte" ni "hay cantidades suficientes". Termina con "¿Necesitas algo más?".`,
					);
				}
			} else {
				// Sin cantidad: incluir datos completos del producto
				parts.push(
					`\nDATO EXACTO DEL PRODUCTO (usa ÚNICAMENTE estos datos para precio y disponibilidad, no uses conocimiento externo ni inventes valores):\nNombre: ${p.name}` +
						(p.description ? `\nDescripción: ${p.description}` : '') +
						`\nVariantes y precios:\n${variantDetails}`,
				);
				if (totalQty === 1) {
					parts.push(
						'\nSolo hay 1 unidad disponible. El cliente ya confirmó que quiere llevarlo. No preguntes por cantidad. Confirma el producto y precio de forma natural y guía hacia el siguiente paso (datos de envío, método de pago, etc.).',
					);
				} else if (ctx.lastBotMessage) {
					parts.push(
						`\nTu último mensaje al cliente fue: "${ctx.lastBotMessage}"\nEl cliente está respondiendo a eso. Interpreta su respuesta en ese contexto y continúa de forma natural.`,
					);
				} else {
					parts.push(
						'\nMenciona el nombre del producto, el precio y las unidades disponibles en UNA sola frase corta. No describas el producto ni añadas texto de relleno. Luego haz UNA pregunta directa como "¿Cuántas quieres?" o "¿Cuántas necesitas?".',
					);
				}
			}
			parts.push(
				'\nNo anuncies la selección ni uses frases como "has elegido". Integra el producto de forma natural en la conversación.',
			);
		} else if (ctx.resumptionProduct && !isGenericGreeting) {
			// const p = ctx.resumptionProduct;
			// const variantDetails = p.variants
			// 	.map(
			// 		v =>
			// 			`  - ${v.name}: ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`,
			// 	)
			// 	.join('\n');
			parts.push(
				`\nEl cliente regresa después de un tiempo. Retoma la conversación de forma natural, sin repetir saludos innecesarios. Guía al cliente con una pregunta simple para continuar.`,
			);
		} else if (ctx.products && ctx.products.length > 0) {
			const productList = ctx.products
				.map((p, i) => {
					if (p.variants.length === 1) {
						const v = p.variants[0];
						const label = v.name
							? `${p.name} ${v.name}`
							: p.description
								? `${p.name} (${p.description})`
								: p.name;
						return `${i + 1}. ${label} – ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`;
					}
					const variantLines = p.variants
						.map((v, idx) => {
							const varLabel = v.name || `Opción ${idx + 1}`;
							return `  - ${varLabel}: ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`;
						})
						.join('\n');
					return `${i + 1}. ${p.name}\n${variantLines}`;
				})
				.join('\n');
			parts.push(
				`\nEsta es la lista de productos que tienes disponibles para mostrarle al cliente:\n${productList}`,
			);
			if (ctx.outOfStockProductName) {
				parts.push(
					`\nEl cliente preguntó por "${ctx.outOfStockProductName}" pero no está disponible. PRIMERO di en una frase corta que no lo tienes disponible, y LUEGO presenta la lista de alternativas disponibles. Ejemplo: "La [nombre] no la tenemos disponible en este momento. Sí tenemos:"`,
				);
			} else if (ctx.isShowingMore) {
				if (
					ctx.products.length === 1 &&
					ctx.products[0].variants.length === 1
				) {
					parts.push(
						'\nEl cliente pidió ver más opciones y solo queda este producto con una sola variante. Preséntalo de forma natural y conversacional. Usa frases como "También tenemos [producto]", "Claro, también contamos con [producto]", etc. Menciona el precio y disponibilidad de forma fluida. No hagas listas. Guía hacia la elección con una pregunta directa como "¿Te interesa?" o "¿Quieres llevarlo?".',
					);
				} else {
					parts.push(
						'\nEl cliente pidió ver más opciones. DEBES empezar con una frase que incluya "también" para marcar continuidad, seguida de dos puntos y la lista. Ejemplos OBLIGATORIOS: "También tenemos:", "Claro, también tenemos:", "También contamos con:", "Sí, también hay:". NO uses "Te puedo ofrecer:", "Tenemos:", ni ninguna frase sin "también". No escribas frases largas antes de la lista. MUESTRA TODAS las variantes de cada producto.',
					);
				}
			} else {
				parts.push(
					'\nIntroduce la lista con una frase MUY corta de máximo 4 palabras seguida de dos puntos, y luego la lista. Ejemplos: "Tenemos:", "Te puedo ofrecer:", "Tenemos disponible:", "Aquí van:". NO añadas explicaciones, contexto, ni texto adicional antes o después de la lista (evita frases como "que pueden interesarte para tus X", "Aquí te dejo las opciones disponibles", etc.).',
				);
			}
			if (ctx.hasMoreProducts) {
				parts.push(
					'\nTermina con una sola pregunta corta para que elija un producto. Varía la pregunta cada vez: "¿Cuál te interesa?", "Cuál quieres llevar?", "¿Te interesa alguna?", etc. NO añadas ninguna frase sobre ver más opciones: el cliente ya sabe que puede pedirlas.',
				);
			} else if (
				ctx.products.length === 1 &&
				ctx.products[0].variants.length === 1
			) {
				parts.push(
					'\nSolo hay un producto con una sola variante. Preséntalo en UNA sola frase breve: nombre, precio y unidades disponibles. NO añadas descripción, ventajas ni texto de relleno. Al final haz una pregunta corta en singular como "¿Te interesa?" o "¿Quieres llevarlo?". NO uses preguntas en plural.',
				);
			} else if (
				ctx.products.length === 1 &&
				ctx.products[0].variants.length > 1
			) {
				parts.push(
					`\nHay un solo producto pero con ${ctx.products[0].variants.length} variantes. DEBES mostrar TODAS las variantes de la lista para que el cliente elija. No omitas ninguna. Al final pregunta cuál prefiere con una frase corta como "¿Cuál prefieres?" o "¿Con cuál te quedas?".`,
				);
			} else {
				parts.push(
					'\nAl final haz una sola pregunta directa para que el cliente elija, por ejemplo: "¿Cuál te interesa?" o "¿Cuál deseas llevar?".',
				);
			}
		} else if (ctx.intent === 'show_cart') {
			if (ctx.cart && ctx.cart.length > 0) {
				const cartLines = ctx.cart
					.map(item => {
						const name = item.variantName
							? `${item.productName} ${item.variantName}`
							: item.productName;
						const unitPrice = formatPrice(item.unitPrice, item.currency);
						const total = item.unitPrice
							? formatPrice(
									String(Number(item.unitPrice) * item.quantity),
									item.currency,
								)
							: null;
						return total
							? `- ${item.quantity}x ${name} a ${unitPrice} = ${total}`
							: `- ${item.quantity}x ${name} a ${unitPrice}`;
					})
					.join('\n');
				const grandTotal = ctx.cart.reduce((sum, item) => {
					return (
						sum + (item.unitPrice ? Number(item.unitPrice) * item.quantity : 0)
					);
				}, 0);
				const grandTotalFormatted = formatPrice(
					String(grandTotal),
					ctx.cart[0].currency,
				);
				parts.push(
					`\nEl cliente pide ver el resumen de su pedido. Estos son los productos que lleva:\n${cartLines}\nTotal: ${grandTotalFormatted}\n` +
						'Muestra el resumen de forma natural y conversacional. Menciona cada producto con su cantidad, precio unitario y subtotal. Al final muestra el total general. Termina invitándolo a cerrar la compra con una pregunta directa como "¿Te ayudo a finalizar el pedido?" o "¿Finalizamos la compra?". NO preguntes "cómo quieres continuar" ni des opciones abiertas.',
				);
			} else {
				parts.push(
					'\nEl cliente pide ver su pedido pero no tiene ningún producto agregado todavía. Responde de forma natural y guíalo a elegir algo.',
				);
			}
		} else if (ctx.intent === 'edit_cart') {
			if (ctx.removedProduct) {
				parts.push(`\nSe eliminó del pedido: ${ctx.removedProduct}.`);
			}
			if (ctx.addedProduct && ctx.addedQuantity) {
				const v =
					ctx.addedProduct.variants.length === 1
						? ctx.addedProduct.variants[0]
						: undefined;
				const label = v?.name
					? `${ctx.addedProduct.name} ${v.name}`
					: ctx.addedProduct.name;
				const totalPrice =
					v?.price != null ? Number(v.price) * ctx.addedQuantity : null;
				const totalFmt =
					totalPrice !== null
						? formatPrice(String(totalPrice), ctx.currency ?? 'USD')
						: null;
				parts.push(
					`\nAhora hay en total ${ctx.addedQuantity}x ${label} en el pedido` +
						(totalFmt ? ` (subtotal ${totalFmt})` : '') +
						'. Usa EXACTAMENTE esa cantidad y ese total en tu respuesta, sin recalcular.',
				);
			} else if (ctx.cart && ctx.cart.length > 0) {
				const updatedLines = ctx.cart
					.map(item => {
						const name = item.variantName
							? `${item.productName} ${item.variantName}`
							: item.productName;
						return `- ${item.quantity}x ${name}`;
					})
					.join('\n');
				parts.push(`\nEl pedido actualizado queda así:\n${updatedLines}`);
			}
			parts.push(
				'\nConfirma el cambio en UNA frase corta y directa. ' +
					'Si se actualizó la cantidad, menciona la nueva cantidad y el precio total si está disponible. ' +
					(ctx.removedProduct
						? 'Menciona que se quitó el producto indicado. '
						: 'NO menciones eliminaciones. ') +
					'Luego pregunta si necesita algo más.',
			);
		} else if (ctx.intent === 'general_question') {
			parts.push(
				'\nEl cliente hace una pregunta general (envíos, pagos, tiempos de entrega, políticas, etc.).' +
					'\nResponde de forma natural y breve. Si no tienes la información exacta, invita al cliente a contactar al equipo directamente.' +
					'\nNunca inventes datos concretos como precios de envío, tiempos exactos o métodos de pago que no se te hayan proporcionado.',
			);
		} else if (ctx.intent === 'request_quote') {
			parts.push(
				'\nEl cliente quiere generar una cotización con lo que lleva en su pedido.' +
					'\nNecesitamos sus datos para armarla. Pídele su nombre completo y número de cédula (o documento de identidad) de forma natural.' +
					'\nEjemplo: "¡Claro! Para armarte la cotización necesito tu nombre completo y tu número de cédula."' +
					'\nSé breve y directa, no repitas el contenido del pedido.',
			);
		} else if (ctx.intent === 'awaiting_customer_data') {
			parts.push(
				'\nEstamos recopilando los datos del cliente para la cotización.' +
					'\nEl cliente debería haber enviado su nombre y cédula. Si falta alguno, pídelo de forma natural.' +
					'\nSi ya tenemos ambos datos, pídele su dirección y ciudad para completar la cotización.' +
					'\nSé breve y conversacional.',
			);
		} else if (ctx.intent === 'awaiting_address') {
			parts.push(
				'\nNecesitamos la dirección y ciudad del cliente para la cotización.' +
					'\nPídele su dirección de entrega y la ciudad de forma natural.' +
					'\nEjemplo: "Ahora necesito tu dirección de entrega y la ciudad, por favor."' +
					'\nSé breve.',
			);
		} else if (ctx.intent === 'awaiting_city_selection') {
			if (ctx.cityCandidates && ctx.cityCandidates.length > 0) {
				const cityList = ctx.cityCandidates
					.map(c => `${c.index}. ${c.name}, ${c.region}`)
					.join('\n');
				parts.push(
					`\nEl cliente escribió una ciudad y encontramos varias coincidencias:\n${cityList}` +
						'\nPídele que elija el número de la opción correcta. Sé breve.',
				);
			}
		} else if (ctx.intent === 'existing_customer_confirmation') {
			const d = ctx.quoteFlowData;
			const cartSummary =
				ctx.cart && ctx.cart.length > 0
					? ctx.cart
							.map(item => {
								const name = item.variantName
									? `${item.productName} ${item.variantName}`
									: item.productName;
								const total = item.unitPrice
									? formatPrice(
											String(Number(item.unitPrice) * item.quantity),
											item.currency,
										)
									: '';
								return `- ${item.quantity}x ${name}${total ? ` = ${total}` : ''}`;
							})
							.join('\n')
					: '';
			parts.push(
				`\nEl cliente ya está registrado en el sistema. Llámalo por su nombre (sin apellido) (${d?.fullName ?? ''}) de forma natural y dile que ya tienes sus datos. Ejemplo: "Sr. Carlos, me aparece registrado en el sistema con estos datos:". Ten en cuenta si es hombre o mujer.` +
					`\nMuéstrale el siguiente resumen:` +
					`\nNombre: ${d?.fullName ?? ''}` +
					`\nCédula: ${d?.dni ?? ''}` +
					`\nDirección: ${d?.location ?? ''}` +
					`\nCiudad: ${d?.cityName ?? ''}` +
					(cartSummary ? `\n\nPedido:\n${cartSummary}` : '') +
					'\n\nPregúntale si con estos datos y este pedido procedemos a generar la cotización. Si quiere cambiar algo, que te indique qué corregir. Sé natural y cercano, no suenes a sistema.',
			);
		} else if (ctx.intent === 'awaiting_confirmation') {
			const d = ctx.quoteFlowData;
			const cartSummary =
				ctx.cart && ctx.cart.length > 0
					? ctx.cart
							.map(item => {
								const name = item.variantName
									? `${item.productName} ${item.variantName}`
									: item.productName;
								const total = item.unitPrice
									? formatPrice(
											String(Number(item.unitPrice) * item.quantity),
											item.currency,
										)
									: '';
								return `- ${item.quantity}x ${name}${total ? ` = ${total}` : ''}`;
							})
							.join('\n')
					: '';
			parts.push(
				`\nMuéstrale al cliente este resumen para que confirme:` +
					`\n\nDatos:` +
					`\nNombre: ${d?.fullName ?? ''}` +
					`\nCédula: ${d?.dni ?? ''}` +
					`\nTeléfono: ${d?.phoneNumber ?? ''}` +
					`\nDirección: ${d?.location ?? ''}` +
					`\nCiudad: ${d?.cityName ?? ''}` +
					(cartSummary ? `\n\nProductos:\n${cartSummary}` : '') +
					'\n\nPregunta si todo está correcto para generar la cotización. Si quiere cambiar algo, que te indique qué corregir.',
			);
		} else if (ctx.intent === 'awaiting_correction_unclear') {
			const d = ctx.quoteFlowData;
			parts.push(
				`\nEl cliente quiere corregir algo del resumen pero no queda claro qué. Los datos actuales son:` +
					`\nNombre: ${d?.fullName ?? ''}` +
					`\nCédula: ${d?.dni ?? ''}` +
					`\nTeléfono: ${d?.phoneNumber ?? ''}` +
					`\nDirección: ${d?.location ?? ''}` +
					`\nCiudad: ${d?.cityName ?? ''}` +
					'\n\nPide amablemente que te indique cuál dato quiere cambiar y cuál es el valor correcto. Sé breve y directo.',
			);
		} else if (ctx.intent === 'quote_created') {
			parts.push(
				`\nLa cotización fue generada exitosamente.` +
					(ctx.quoteSerialNumber
						? `\nNúmero de referencia: ${ctx.quoteSerialNumber}`
						: '') +
					'\nConfirma al cliente que su cotización fue creada.' +
					'\nDespídete de forma cálida y deja la puerta abierta para futuras consultas.',
			);
		} else {
			parts.push(
				'\nNo se encontraron productos para esta consulta. Responde de forma conversacional pidiendo más información sobre lo que busca.',
			);
		}

		parts.push(
			'\nRecuerda: responde como una persona real, evita sonar como sistema y usa una sola pregunta clara al final.',
		);

		return parts.join('\n');
	};

	/**
	 * Extrae datos estructurados del mensaje del cliente según el paso del flujo de cotización.
	 * - 'customer_data': extrae fullName y dni del texto libre.
	 * - 'address': extrae la dirección (location) y opcionalmente la ciudad.
	 */
	extractCustomerData = async (
		text: string,
		step: 'customer_data' | 'address',
	): Promise<Record<string, string | undefined>> => {
		const prompts: Record<string, string> = {
			customer_data: `Extrae del siguiente mensaje el nombre completo y el número de documento (cédula/DNI/RUC) del cliente.
Devuelve un JSON con:
- "fullName": nombre completo (capitalizado correctamente). Si no lo mencionó, null.
- "dni": número de documento tal como lo escribió. Si no lo mencionó, null.
Responde ÚNICAMENTE con el JSON.`,
			address: `Extrae del siguiente mensaje la dirección y opcionalmente la ciudad del cliente.
Devuelve un JSON con:
- "location": dirección física tal como la escribió. Si no la mencionó, null.
- "city": nombre de la ciudad si la mencionó. Si no la mencionó, null.
Responde ÚNICAMENTE con el JSON.`,
		};

		const response = await this.client.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{ role: 'system', content: prompts[step] },
				{ role: 'user', content: text },
			],
			max_tokens: 150,
			temperature: 0,
			response_format: { type: 'json_object' },
		});

		const raw = response.choices[0]?.message?.content?.trim() ?? '{}';
		return JSON.parse(raw) as Record<string, string | undefined>;
	};

	/**
	 * Detects which quote data field(s) the customer wants to correct and extracts the new value(s).
	 */
	extractQuoteCorrection = async (
		text: string,
		currentData: Record<string, unknown>,
	): Promise<Record<string, string | undefined>> => {
		const prompt = `El cliente está revisando un resumen de cotización con estos datos:
- Nombre: ${currentData.fullName ?? 'no proporcionado'}
- Cédula: ${currentData.dni ?? 'no proporcionado'}
- Teléfono: ${currentData.phoneNumber ?? 'no proporcionado'}
- Dirección: ${currentData.location ?? 'no proporcionado'}
- Ciudad: ${currentData.cityName ?? 'no proporcionado'}

El cliente quiere CORREGIR uno o más datos. Analiza su mensaje e identifica qué campos quiere cambiar y cuáles son los nuevos valores.

Devuelve un JSON con SOLO los campos que el cliente quiere corregir:
- "fullName": nuevo nombre completo (capitalizado correctamente). Solo si quiere cambiar el nombre.
- "dni": nuevo número de documento. Solo si quiere cambiar la cédula/DNI.
- "phoneNumber": nuevo número de teléfono (solo dígitos, sin código de país). Solo si quiere cambiar el teléfono.
- "location": nueva dirección. Solo si quiere cambiar la dirección.
- "city": nueva ciudad. Solo si quiere cambiar la ciudad.

Si el mensaje contiene un número largo (6-12 dígitos) sin contexto claro, probablemente es una corrección de cédula.
Si no puedes determinar qué quiere corregir, devuelve un JSON vacío {}.
Responde ÚNICAMENTE con el JSON.`;

		const response = await this.client.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{ role: 'system', content: prompt },
				{ role: 'user', content: text },
			],
			max_tokens: 200,
			temperature: 0,
			response_format: { type: 'json_object' },
		});

		const raw = response.choices[0]?.message?.content?.trim() ?? '{}';
		return JSON.parse(raw) as Record<string, string | undefined>;
	};
}
