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
-Preséntalos en lista numerada clara:
	1. Nombre – precio - cantidad disponible
-No uses asteriscos ni markdown para resaltar.
-No agregues información que no se haya proporcionado.
-Después de mostrarlos, haz una sola pregunta directa para que el cliente elija un producto, por ejemplo: "¿Cuál te interesa?" o "¿Cuál deseas llevar?".
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
- Usa la descripción del producto para dar contexto natural sobre él.
- Menciona el precio y disponibilidad de forma fluida dentro del texto, no en forma de lista.
- Invita a continuar (cotización, cantidad, etc.).
- Haz solo UNA pregunta al final.
- La pregunta debe ser corta, clara y directa.
- Evita preguntas dobles o largas.
- Ejemplo de tono correcto: "Perfecto 👌
- No hagas preguntas abiertas después de mostrar un producto.
- No preguntes si quiere más información.
- Asume intención de compra y guía hacia cantidad o siguiente paso.

Esta cera de palma en presentación de 1 kilo es muy buena para velas en vaso y deja un acabado bastante limpio.
Tenemos 23 unidades disponibles a $22.500.

¿Cuántas necesitas?"
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

export interface OpenAIContext {
	userMessage: string;
	products?: OpenAIProduct[];
	hasMoreProducts?: boolean;
	isShowingMore?: boolean;
	selectedProduct?: OpenAIProduct;
	resumptionProduct?: OpenAIProduct;
	currency?: string;
	isFirstInteraction?: boolean;
	intent?: string;
	lastBotMessage?: string;
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
							const label = v.name ? `${p.name} ${v.name}` : p.name;
							return `${i + 1}. ${label} – ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`;
						}
						const variantLines = p.variants
							.map(
								v =>
									`  - ${v.name}: ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`,
							)
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
							const label = v.name ? `${p.name} ${v.name}` : p.name;
							return `${i + 1}. ${label} – ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`;
						}
						const variantLines = p.variants
							.map(
								v =>
									`  - ${v.name}: ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`,
							)
							.join('\n');
						return `${i + 1}. ${p.name}\n${variantLines}`;
					})
					.join('\n');
				parts.push(
					`\nProductos disponibles en la conversación actual (usa si son relevantes para continuar):\n${productList}`,
				);
			}
		} else if (ctx.selectedProduct) {
			const p = ctx.selectedProduct;
			const variantDetails = p.variants
				.map(
					v =>
						`  - ${v.name}: ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`,
				)
				.join('\n');
			parts.push(
				`\nEl cliente seleccionó este producto:\nNombre: ${p.name}` +
					(p.description ? `\nDescripción: ${p.description}` : '') +
					`\nVariantes:\n${variantDetails}`,
			);
			parts.push(
				'\nResponde de forma natural como si ya estuvieran hablando de este producto. Explica brevemente, menciona precio y disponibilidad, y guía la conversación para continuar.',
			);
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
						const label = v.name ? `${p.name} ${v.name}` : p.name;
						return `${i + 1}. ${label} – ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`;
					}
					const variantLines = p.variants
						.map(
							v =>
								`  - ${v.name}: ${formatPrice(v.price, currency)} (${v.totalQty} disponibles)`,
						)
						.join('\n');
					return `${i + 1}. ${p.name}\n${variantLines}`;
				})
				.join('\n');
			parts.push(
				`\nEsta es la lista de productos que tienes disponibles para mostrarle al cliente:\n${productList}`,
			);
			if (ctx.isShowingMore) {
				parts.push(
					'\nEl cliente pidió ver más opciones. Empieza directamente con una introducción MUY breve (máximo 3-4 palabras) seguida de dos puntos y la lista. Varía la introducción cada vez: "También tenemos:", "Más opciones:", "También contamos con:", "Aquí hay más:", "Mira, también hay:", etc. No escribas frases largas antes de la lista. No repitas el saludo.',
				);
			} else {
				parts.push(
					'\nPresenta estos productos de forma natural y humana, como si los estuvieras ofreciendo en persona. Usa frases como "Tenemos disponible...", "Te puedo ofrecer...", "Contamos con..." u otras similares. No uses encabezados de sistema ni frases como "He encontrado" o "Productos encontrados".',
				);
			}
			if (ctx.hasMoreProducts) {
				parts.push(
					'\nTermina con una sola pregunta corta para que elija un producto. Varía la pregunta cada vez: "¿Cuál te interesa?", "Cuál quieres llevar?", "¿Te interesa alguna?", etc. NO añadas ninguna frase sobre ver más opciones: el cliente ya sabe que puede pedirlas.',
				);
			} else {
				parts.push(
					'\nAl final haz una sola pregunta directa para que el cliente elija, por ejemplo: "¿Cuál te interesa?" o "¿Cuál deseas llevar?".',
				);
			}
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
}
