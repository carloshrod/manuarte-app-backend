"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppAgentService = void 0;
const axios_1 = __importStar(require("axios"));
const crypto_1 = __importDefault(require("crypto"));
const date_fns_tz_1 = require("date-fns-tz");
const sequelize_1 = require("sequelize");
const database_1 = require("../../config/database");
const env_1 = require("../../config/env");
const redis_1 = require("../../config/redis");
const model_1 = require("../product/model");
const model_2 = require("../product-variant/model");
const model_3 = require("../stock-item/model");
const model_4 = require("../stock/model");
const model_5 = require("../shop/model");
const model_6 = require("../country/model");
const log_service_1 = require("./logging/log.service");
const openai_service_1 = require("./openai.service");
const payment_link_service_1 = require("./payment-link.service");
const utils_1 = require("./utils");
const service_1 = require("../quote/service");
const model_7 = require("../quote/model");
const types_1 = require("../quote/types");
const service_2 = require("../whatsapp/service");
const utils_2 = require("../docs/utils");
const service_3 = require("../customer/service");
const model_8 = require("../customer/model");
const service_4 = require("../city/service");
const model_9 = require("../city/model");
const model_10 = require("../person/model");
const service_5 = require("../docs/service");
const service_6 = require("../billing/service");
const model_11 = require("../billing/model");
const WHATSAPP_API_TIMEOUT_MS = 10000;
const BUFFER_WAIT_MS = 5000; // espera antes de procesar mensajes acumulados
const REPLY_DELAY_MS = 2500; // delay para simular tiempo de escritura humano
const SESSION_TTL_SECONDS = 60 * 60 * 2; // 2 horas
const MAX_PRODUCT_RESULTS = 5;
class WhatsAppAgentService {
    constructor() {
        this.messageBuffer = new Map();
        this.processingQueue = new Map();
        this.logService = new log_service_1.WhatsAppLogService();
        this.openai = new openai_service_1.OpenAIService();
        this.paymentLinkService = new payment_link_service_1.PaymentLinkService();
        this.quoteService = new service_1.QuoteService(model_7.QuoteModel);
        this.docsService = new service_5.DocsService(this.quoteService, new service_6.BillingService(model_11.BillingModel));
        this.whatsAppService = new service_2.WhatsAppService();
        this.customerService = new service_3.CustomerService(model_8.CustomerModel);
        this.cityService = new service_4.CityService(model_9.CityModel);
        this.verifyWebhook = (mode, token, challenge) => {
            if (mode !== 'subscribe') {
                return { status: 403, message: 'Modo inv├ílido' };
            }
            if (token !== env_1.ENV.WHATSAPP_VERIFY_TOKEN) {
                return { status: 403, message: 'Token de verificaci├│n inv├ílido' };
            }
            return { status: 200, challenge };
        };
        this.receiveMessage = (body) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
            console.log('**************** receiving message ****************');
            const payload = body;
            if (!(payload === null || payload === void 0 ? void 0 : payload.entry)) {
                console.warn('[WhatsApp Agent] Payload without entry, ignoring.');
                return { status: 200, message: 'Sin datos para procesar.' };
            }
            try {
                const entry = (_a = payload === null || payload === void 0 ? void 0 : payload.entry) === null || _a === void 0 ? void 0 : _a[0];
                const changes = (_b = entry === null || entry === void 0 ? void 0 : entry.changes) === null || _b === void 0 ? void 0 : _b[0];
                const value = changes === null || changes === void 0 ? void 0 : changes.value;
                const messages = (_c = value === null || value === void 0 ? void 0 : value.messages) === null || _c === void 0 ? void 0 : _c[0];
                if (value === null || value === void 0 ? void 0 : value.statuses) {
                    console.log('[WhatsApp Agent] Status update event, ignoring.');
                    return { status: 200, message: 'Status update ignorado.' };
                }
                const text = (_e = (_d = messages === null || messages === void 0 ? void 0 : messages.text) === null || _d === void 0 ? void 0 : _d.body) !== null && _e !== void 0 ? _e : null;
                const imageId = (_g = (_f = messages === null || messages === void 0 ? void 0 : messages.image) === null || _f === void 0 ? void 0 : _f.id) !== null && _g !== void 0 ? _g : null;
                const documentId = (_j = (_h = messages === null || messages === void 0 ? void 0 : messages.document) === null || _h === void 0 ? void 0 : _h.id) !== null && _j !== void 0 ? _j : null;
                const botPhoneNumberId = (_l = (_k = value === null || value === void 0 ? void 0 : value.metadata) === null || _k === void 0 ? void 0 : _k.phone_number_id) !== null && _l !== void 0 ? _l : null;
                const phoneNumber = (_m = messages === null || messages === void 0 ? void 0 : messages.from) !== null && _m !== void 0 ? _m : null;
                const timestamp = (_o = messages === null || messages === void 0 ? void 0 : messages.timestamp) !== null && _o !== void 0 ? _o : null;
                const message_id = (_p = messages === null || messages === void 0 ? void 0 : messages.id) !== null && _p !== void 0 ? _p : null;
                if (timestamp) {
                    const ageMs = Date.now() - Number(timestamp) * 1000;
                    const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutos
                    if (ageMs > MAX_AGE_MS) {
                        console.warn(`[WhatsApp Agent] Stale message (${Math.round(ageMs / 1000)}s old), ignoring.`);
                        return { status: 200, message: 'Mensaje antiguo ignorado.' };
                    }
                }
                console.log(botPhoneNumberId);
                if (!botPhoneNumberId) {
                    console.warn('[WhatsApp Agent] Event without phone_number_id (status update?), ignoring.');
                    return { status: 200, message: 'Evento sin phoneNumberId del bot.' };
                }
                if (env_1.ENV.WHATSAPP_AGENT_PHONE_NUMBER_ID &&
                    botPhoneNumberId !== env_1.ENV.WHATSAPP_AGENT_PHONE_NUMBER_ID) {
                    console.log('[WhatsApp Agent] phoneNumberId no coincide con el configurado, ignorando mensaje de:', phoneNumber);
                    return { status: 200, message: 'phoneNumberId no autorizado.' };
                }
                console.log('[WhatsApp Agent] Incoming message:', {
                    text,
                    botPhoneNumberId,
                    phoneNumber,
                    timestamp,
                    message_id,
                });
                if (!messages) {
                    console.warn('[WhatsApp Agent] Event without messages, ignoring.');
                    return { status: 200, message: 'Evento sin mensajes.' };
                }
                const mediaId = (_q = imageId !== null && imageId !== void 0 ? imageId : documentId) !== null && _q !== void 0 ? _q : null;
                const mediaType = imageId
                    ? 'image'
                    : documentId
                        ? 'document'
                        : null;
                if (!text && !mediaId) {
                    console.warn('[WhatsApp Agent] Event without text or media, ignoring.');
                    return { status: 200, message: 'Evento sin texto ni media.' };
                }
                if (mediaId && mediaType && phoneNumber && botPhoneNumberId) {
                    this.handleIncomingImage(phoneNumber, botPhoneNumberId, mediaId, mediaType).catch(err => console.error('[WhatsApp Agent] Error handling incoming media:', err));
                }
                else if (text && phoneNumber && botPhoneNumberId) {
                    this.bufferMessage(phoneNumber, botPhoneNumberId, text);
                }
            }
            catch (error) {
                console.error('[WhatsApp Agent] Error processing message:', error);
                this.logService
                    .logError({ context: 'receiveMessage', error })
                    .catch(e => console.error('[WhatsApp Agent] Failed to save error log:', e));
                return { status: 500, message: 'Error interno del servidor.' };
            }
            return { status: 200, message: 'Mensaje recibido.' };
        });
        this.bufferMessage = (phoneNumber, botPhoneNumberId, text) => {
            const existing = this.messageBuffer.get(phoneNumber);
            if (existing) {
                clearTimeout(existing.timer);
                existing.texts.push(text);
            }
            else {
                this.messageBuffer.set(phoneNumber, {
                    botPhoneNumberId,
                    texts: [text],
                    timer: setTimeout(() => { }, 0), // placeholder, se reemplaza abajo
                });
            }
            const entry = this.messageBuffer.get(phoneNumber);
            entry.timer = setTimeout(() => {
                this.messageBuffer.delete(phoneNumber);
                const combined = entry.texts.join(' ');
                console.log(`[WhatsApp Agent] Processing buffered messages from ${phoneNumber}: "${combined}"`);
                this.processAndReply(phoneNumber, entry.botPhoneNumberId, combined).catch(err => {
                    console.error('[WhatsApp Agent] Error in processAndReply:', err);
                    this.logService
                        .logError({ context: 'processAndReply', error: err, phoneNumber })
                        .catch(e => console.error('[WhatsApp Agent] Failed to save error log:', e));
                });
            }, BUFFER_WAIT_MS);
        };
        this.processAndReply = (phoneNumber, botPhoneNumberId, text) => __awaiter(this, void 0, void 0, function* () {
            // Cola serial por usuario: garantiza que no se procesen dos mensajes del
            // mismo n├║mero en paralelo, evitando que un handler sobrescriba los
            // cambios de sesi├│n (carrito) que hizo otro handler concurrente.
            const prev = this.processingQueue.get(phoneNumber);
            let resolveCurrent;
            const current = new Promise(resolve => {
                resolveCurrent = resolve;
            });
            this.processingQueue.set(phoneNumber, current);
            if (prev)
                yield prev;
            try {
                yield this.doProcessAndReply(phoneNumber, botPhoneNumberId, text);
            }
            finally {
                resolveCurrent();
                // Limpiar la entrada solo si sigue siendo la nuestra (no hay otra en cola)
                if (this.processingQueue.get(phoneNumber) === current) {
                    this.processingQueue.delete(phoneNumber);
                }
            }
        });
        this.doProcessAndReply = (phoneNumber, botPhoneNumberId, text) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18, _19, _20, _21, _22, _23, _24, _25, _26, _27, _28, _29, _30, _31, _32, _33, _34, _35, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, _53, _54, _55, _56, _57, _58, _59, _60, _61, _62, _63, _64, _65, _66, _67, _68, _69, _70, _71, _72, _73, _74, _75, _76, _77;
            const normalizedText = (0, utils_1.normalizeText)(text);
            const countryInfo = yield this.detectCountryFromPhone(phoneNumber);
            const countryPrefix = countryInfo
                ? `+${phoneNumber.startsWith('593') ? '593' : '57'}`
                : null;
            const raw = yield redis_1.redis.get(`session:${phoneNumber}`);
            const session = raw ? JSON.parse(raw) : {};
            const now = Date.now();
            const RESUMPTION_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutos
            const hasActiveList = ((_b = (_a = session.lastProductList) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0;
            const isFirstInteraction = !session.lastActivityAt;
            const isResumption = !isFirstInteraction &&
                now - session.lastActivityAt > RESUMPTION_THRESHOLD_MS &&
                hasActiveList;
            session.lastActivityAt = now;
            yield redis_1.redis.set(`session:${phoneNumber}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
            // ÔöÇÔöÇ Interceptor: flujo de compra activo ÔöÇÔöÇ
            if (session.pendingPurchaseFlow) {
                const purchaseReply = yield this.handlePurchaseFlowStep(phoneNumber, botPhoneNumberId, text, normalizedText, session, countryInfo);
                if (purchaseReply !== null) {
                    session.lastBotMessage = purchaseReply;
                    yield redis_1.redis.set(`session:${phoneNumber}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
                    yield new Promise(resolve => setTimeout(resolve, REPLY_DELAY_MS));
                    yield this.sendReply(phoneNumber, botPhoneNumberId, purchaseReply);
                    this.logService
                        .logMessage({
                        phoneNumber,
                        botPhoneNumberId,
                        direction: 'outbound',
                        text: purchaseReply,
                        intent: 'purchase_flow',
                        countryPrefix: countryInfo
                            ? `+${phoneNumber.startsWith('593') ? '593' : '57'}`
                            : null,
                    })
                        .catch(err => console.error('[WhatsApp Agent] Error saving outbound log:', err));
                    return;
                }
            }
            // ÔöÇÔöÇ Interceptor: flujo de cotizaci├│n activo ÔöÇÔöÇ
            if (session.pendingQuoteFlow) {
                const quoteReply = yield this.handleQuoteFlowStep(phoneNumber, botPhoneNumberId, text, normalizedText, session, countryInfo);
                if (quoteReply !== null) {
                    session.lastBotMessage = quoteReply;
                    yield redis_1.redis.set(`session:${phoneNumber}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
                    const countryPrefix = countryInfo
                        ? `+${phoneNumber.startsWith('593') ? '593' : '57'}`
                        : null;
                    yield new Promise(resolve => setTimeout(resolve, REPLY_DELAY_MS));
                    yield this.sendReply(phoneNumber, botPhoneNumberId, quoteReply);
                    this.logService
                        .logMessage({
                        phoneNumber,
                        botPhoneNumberId,
                        direction: 'outbound',
                        text: quoteReply,
                        intent: 'quote_flow',
                        countryPrefix,
                    })
                        .catch(err => console.error('[WhatsApp Agent] Error saving outbound log:', err));
                    return;
                }
            }
            const selectionIndex = this.detectSelection(normalizedText);
            const nameSelectionIndex = selectionIndex === null && hasActiveList
                ? this.detectSelectionByName(normalizedText, (_c = session.lastProductList) !== null && _c !== void 0 ? _c : [])
                : null;
            const effectiveSelectionIndex = selectionIndex !== null && selectionIndex !== void 0 ? selectionIndex : nameSelectionIndex;
            // Checks determin├¡sticos: show_more y affirmation tambi├®n los resuelve el backend
            const deterministicIntent = this.detectDeterministicIntent(normalizedText);
            let intent;
            let aiSearchQuery;
            let aiSelectionIndexes;
            let aiVariantHint;
            let aiQuantity;
            let aiQuantities;
            let aiRemoveProductHint;
            let aiAddProductHint;
            let aiCartEdits;
            let aiProductList;
            if (isResumption && deterministicIntent !== 'search_product') {
                intent = 'resumption';
            }
            else if (deterministicIntent !== null) {
                intent = deterministicIntent;
            }
            else {
                // Helper: true si el texto menciona palabras de un producto DIFERENTE al selectedProduct,
                // tanto en el carrito como en la lista activa.
                const checkMentionsDifferentProduct = () => {
                    var _a, _b;
                    return !!(session.selectedProduct &&
                        (((_a = session.cart) === null || _a === void 0 ? void 0 : _a.some(item => {
                            if (item.productName === session.selectedProduct)
                                return false;
                            const words = (0, utils_1.normalizeText)(item.productName)
                                .split(/\s+/)
                                .filter(w => w.length > 3);
                            return words.some(w => normalizedText.includes(w));
                        })) ||
                            ((_b = session.lastProductList) === null || _b === void 0 ? void 0 : _b.some(p => {
                                if (p.name === session.selectedProduct)
                                    return false;
                                const words = (0, utils_1.normalizeText)(p.name)
                                    .split(/\s+/)
                                    .filter(w => w.length > 3);
                                return words.some(w => normalizedText.includes(w));
                            }))));
                };
                // Deterministic override (PRIORITARIO): si detectSelectionByName encontr├│ un
                // producto DIFERENTE al seleccionado, forzar select_product ANTES de los bloques
                // de cantidad/peso. Esto evita que "6 kilos de la cca" se interprete como
                // cantidad de KARITE cuando CCA es un producto diferente en la lista.
                // Se ejecuta aqu├¡ porque checkMentionsDifferentProduct filtra palabras de <=3
                // caracteres (ej: "cca") y no las detecta como producto diferente.
                if (session.selectedProduct &&
                    hasActiveList &&
                    effectiveSelectionIndex !== null) {
                    const mentionedProduct = (_d = session.lastProductList) === null || _d === void 0 ? void 0 : _d[effectiveSelectionIndex - 1];
                    if (mentionedProduct &&
                        mentionedProduct.name !== session.selectedProduct) {
                        intent = 'select_product';
                        aiSelectionIndexes = [effectiveSelectionIndex];
                        // Extraer cantidad del texto (ej: "tambien dame 2 de la de avena")
                        const qtyMatch = normalizedText.match(/\b(\d+)\b/);
                        if (qtyMatch) {
                            const parsedQty = parseInt(qtyMatch[1], 10);
                            if (parsedQty > 0 && parsedQty <= 1000) {
                                // Verificar si es peso (ej: "2 kilos") ÔåÆ convertir a unidades
                                const requestedGramsDet = this.detectRequestedWeightGrams(normalizedText);
                                if (requestedGramsDet !== null) {
                                    const resolvedV = this.resolveVariant(mentionedProduct, undefined, normalizedText);
                                    const vGrams = resolvedV
                                        ? this.parseVariantWeightGrams(resolvedV.name)
                                        : null;
                                    if (vGrams !== null) {
                                        aiQuantity = Math.ceil(requestedGramsDet / vGrams);
                                    }
                                    else {
                                        aiQuantity = parsedQty;
                                    }
                                }
                                else {
                                    aiQuantity = parsedQty;
                                }
                            }
                        }
                        console.log(`[WhatsApp Agent] Deterministic select_product for different product: "${mentionedProduct.name}" (idx ${effectiveSelectionIndex})` +
                            (aiQuantity !== undefined ? `, qty: ${aiQuantity}` : ''));
                    }
                }
                // Helper: true si el texto menciona nombres de variante de un producto
                // multi-variante en la lista activa (├║til para evitar que "quiero 1 rectangular"
                // se interprete como qty=1 del producto ya seleccionado).
                const mentionsMultiVariantNames = () => {
                    var _a;
                    if (!hasActiveList)
                        return false;
                    return ((_a = session.lastProductList) !== null && _a !== void 0 ? _a : []).some(p => {
                        if (p.variants.length <= 1)
                            return false;
                        return p.variants.some(v => {
                            const vWords = (0, utils_1.normalizeText)(v.name)
                                .split(/\s+/)
                                .filter(w => w.length > 2);
                            return vWords.some(w => normalizedText.includes(w));
                        });
                    });
                };
                // Detecci├│n con contexto de sesi├│n: "dame/quiero/ponme X" cuando hay producto activo
                // Esto evita que la IA clasifique como "unknown" y pierda el contexto del producto
                // NOTA: no aplica cuando el n├║mero va seguido de unidad de peso (ej: "quiero 1 kilo")
                // NOTA: no aplica cuando el texto menciona variantes de un producto multi-variante
                const qtyCommandMatch = !intent
                    ? normalizedText.match(/^(?:dame|quiero|pon|ponme|agrega|necesito|llevo|llevame|mandame|enviame)\s+(\d+)(?!\s*(?:kilo[s]?|kg|gramo[s]?|gr|g\b))(?:\s|$)/i)
                    : null;
                if (qtyCommandMatch && !mentionsMultiVariantNames()) {
                    const extractedQty = parseInt(qtyCommandMatch[1], 10);
                    if (session.selectedProduct && hasActiveList) {
                        // Verificar que el mensaje no mencione un producto DIFERENTE al seleccionado.
                        // Si lo hace, dejar que la IA resuelva (puede ser edit_cart con otro producto).
                        if (!checkMentionsDifferentProduct()) {
                            // Producto ya en contexto: interpretar como cantidad de ese producto
                            intent = 'product_followup';
                            aiQuantity = extractedQty;
                            console.log(`[WhatsApp Agent] Context qty for selected product: ${extractedQty}`);
                        }
                    }
                    else if (hasActiveList &&
                        ((_f = (_e = session.lastProductList) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : 0) === 1) {
                        // Un solo producto en lista: selecci├│n impl├¡cita con cantidad
                        intent = 'select_product';
                        aiSelectionIndexes = [1];
                        aiQuantity = extractedQty;
                        console.log(`[WhatsApp Agent] Context qty ÔåÆ select_product [1] qty=${extractedQty}`);
                    }
                }
                // Detecci├│n de cantidad por peso (ej: "quiero 1 kilo", "dame 500 gramos")
                // Aplica cuando hay producto seleccionado O cuando la lista activa tiene exactamente
                // 1 producto (el cliente impl├¡citamente se refiere a ese).
                if (!intent && hasActiveList) {
                    const weightProductEntry = session.selectedProduct
                        ? (_g = session.lastProductList) === null || _g === void 0 ? void 0 : _g.find(p => p.name === session.selectedProduct)
                        : ((_h = session.lastProductList) === null || _h === void 0 ? void 0 : _h.length) === 1
                            ? session.lastProductList[0]
                            : undefined;
                    // No aplicar la conversi├│n por peso si el mensaje menciona expl├¡citamente
                    // un producto distinto al seleccionado (ej: "5 kilos de cera" cuando selectedProduct es ├ücido Este├írico).
                    if (weightProductEntry && !checkMentionsDifferentProduct()) {
                        const requestedGrams = this.detectRequestedWeightGrams(normalizedText);
                        if (requestedGrams !== null) {
                            const resolved = this.resolveVariantByWeight(weightProductEntry.variants, requestedGrams);
                            if (resolved) {
                                intent = 'product_followup';
                                aiQuantity = resolved.units;
                                session.selectedProduct = weightProductEntry.name;
                                session.selectedVariantName = resolved.variant.name;
                                console.log(`[WhatsApp Agent] Weight request: ${requestedGrams}g ÔåÆ ${resolved.units}x "${resolved.variant.name}" (product: ${weightProductEntry.name})`);
                            }
                        }
                    }
                }
                if (!intent) {
                    // Pasar siempre la lista activa al clasificador de IA.
                    // Cuando hay un producto seleccionado se a├▒ade nota para que la IA distinga
                    // entre "menciona otro producto de la lista" vs "dice una cantidad".
                    try {
                        // Suppress active product list when message clearly targets a cart item with an
                        // edit verb ÔåÆ prevents AI from picking "select_product" by index
                        const suppressActiveList = !!(hasActiveList &&
                            ((_j = session.cart) === null || _j === void 0 ? void 0 : _j.length) &&
                            /\b(agrega[r]?|a[n├▒]ade[r]?|sum[ae][r]?|quita[r]?|saca[r]?)\b/i.test(normalizedText) &&
                            session.cart.some(item => {
                                const words = (0, utils_1.normalizeText)(item.productName)
                                    .split(/\s+/)
                                    .filter(w => w.length > 3);
                                return words.some(w => normalizedText.includes(w));
                            }));
                        const activeProductsList = hasActiveList && !suppressActiveList
                            ? ((_k = session.lastProductList) !== null && _k !== void 0 ? _k : []).map((p, i) => {
                                const variantNames = p.variants
                                    .map(v => v.name)
                                    .filter(Boolean);
                                const label = variantNames.length === 1
                                    ? `${p.name} ÔÇô ${variantNames[0]}`
                                    : variantNames.length > 1
                                        ? `${p.name} (variantes: ${variantNames.join(', ')})`
                                        : p.name;
                                return { index: i + 1, label };
                            })
                            : undefined;
                        const aiResult = yield this.openai.detectIntentWithAI(text, hasActiveList && !suppressActiveList, activeProductsList, session.awaitingMoreProducts, session.selectedProduct, session.cart);
                        // unknown + producto activo ÔåÆ continuar conversaci├│n del producto
                        // unknown + sin contexto ÔåÆ saludo gen├®rico
                        intent =
                            aiResult.intent === 'unknown'
                                ? session.selectedProduct
                                    ? 'product_followup'
                                    : 'greeting'
                                : aiResult.intent;
                        aiSearchQuery = aiResult.searchQuery;
                        aiSelectionIndexes = aiResult.selectionIndexes;
                        aiVariantHint = aiResult.variantHint;
                        aiQuantity = aiResult.quantity;
                        aiQuantities = aiResult.quantities;
                        aiRemoveProductHint = aiResult.removeProductHint;
                        aiAddProductHint = aiResult.addProductHint;
                        aiCartEdits = aiResult.cartEdits;
                        aiProductList = aiResult.productList;
                        console.log(`[WhatsApp Agent] AI intent: ${aiResult.intent}` +
                            (aiSearchQuery ? `, searchQuery: "${aiSearchQuery}"` : '') +
                            (aiSelectionIndexes
                                ? `, selection: [${aiSelectionIndexes}]`
                                : '') +
                            (aiVariantHint ? `, variantHint: "${aiVariantHint}"` : '') +
                            (aiQuantity !== undefined ? `, qty: ${aiQuantity}` : '') +
                            (aiAddProductHint ? `, addHint: "${aiAddProductHint}"` : '') +
                            (aiRemoveProductHint
                                ? `, removeHint: "${aiRemoveProductHint}"`
                                : '') +
                            (aiCartEdits
                                ? `, cartEdits: ${JSON.stringify(aiCartEdits)}`
                                : ''));
                        // Si detect├│ b├║squeda nueva ÔåÆ limpiar producto seleccionado
                        if (intent === 'search_product') {
                            session.selectedProduct = undefined;
                        }
                    }
                    catch (err) {
                        console.warn('[WhatsApp Agent] AI intent detection failed, falling back to rules:', err);
                        if (effectiveSelectionIndex !== null && hasActiveList) {
                            intent = 'select_product';
                            aiSelectionIndexes = [effectiveSelectionIndex];
                        }
                        else if (session.selectedProduct) {
                            intent = 'product_followup';
                        }
                        else {
                            intent = this.detectIntent(normalizedText);
                        }
                    }
                } // end if (!intent!)
            }
            // Reclasificar: edit_cart + addProductHint sin coincidencia en carrito ÔåÆ search_product
            // Ocurre cuando el cliente pide un producto con cantidad pero el carrito est├í vac├¡o
            // o no tiene ese producto (ej: "Necesito 4 kilos de cera de palma").
            if (intent === 'edit_cart' &&
                aiAddProductHint &&
                !((_l = session.cart) === null || _l === void 0 ? void 0 : _l.some(item => {
                    const fullName = (0, utils_1.normalizeText)(item.variantName
                        ? `${item.productName} ${item.variantName}`
                        : item.productName);
                    const tokens = (0, utils_1.normalizeText)(aiAddProductHint)
                        .split(/\s+/)
                        .filter(t => t.length > 2);
                    return tokens.some(t => fullName.includes(t));
                }))) {
                console.log(`[WhatsApp Agent] Reclassifying edit_cart ÔåÆ search_product: hint "${aiAddProductHint}" not found in cart`);
                intent = 'search_product';
                // Filtrar preposiciones y palabras cortas del hint antes de usarlo como
                // search query, para evitar que "de" contamine el fallback OR en buildProductReply
                const cleanedHint = (0, utils_1.normalizeText)(aiAddProductHint)
                    .split(/\s+/)
                    .filter(w => w.length > 2)
                    .join(' ');
                aiSearchQuery = cleanedHint || undefined;
                session.selectedProduct = undefined;
            }
            console.log(`[WhatsApp Agent] Intent detected: ${intent} (resumption: ${isResumption})`);
            this.logService
                .logMessage({
                phoneNumber,
                botPhoneNumberId,
                direction: 'inbound',
                text,
                intent,
                countryPrefix,
            })
                .catch(err => {
                console.error('[WhatsApp Agent] Error saving inbound message log:', err);
                this.logService
                    .logError({
                    context: 'logMessage:inbound',
                    error: err,
                    phoneNumber,
                    rawText: text,
                })
                    .catch(e => console.error('[WhatsApp Agent] Failed to save error log:', e));
            });
            let replyText;
            if (intent === 'resumption') {
                const lastProduct = session.lastProductList[0];
                const currency = (_p = (_o = (_m = session.lastCountryInfo) === null || _m === void 0 ? void 0 : _m.currency) !== null && _o !== void 0 ? _o : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _p !== void 0 ? _p : 'USD';
                replyText = yield this.openai
                    .generateReply({
                    userMessage: text,
                    resumptionProduct: lastProduct,
                    currency,
                })
                    .catch(() => this.buildResumptionReply(lastProduct));
            }
            else if (intent === 'select_product') {
                const indexes = aiSelectionIndexes !== null && aiSelectionIndexes !== void 0 ? aiSelectionIndexes : [];
                const selectedItems = indexes
                    .map(i => { var _a; return (_a = session.lastProductList) === null || _a === void 0 ? void 0 : _a[i - 1]; })
                    .filter((p) => !!p);
                if (selectedItems.length > 0) {
                    const currency = (_s = (_r = (_q = session.lastCountryInfo) === null || _q === void 0 ? void 0 : _q.currency) !== null && _r !== void 0 ? _r : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _s !== void 0 ? _s : 'USD';
                    // Resolver variante del primer producto (para selectedVariantName de sesi├│n)
                    const firstVariantHint = aiVariantHint;
                    const resolvedVariant = this.resolveVariant(selectedItems[0], firstVariantHint, normalizedText);
                    session.selectedProduct = selectedItems[0].name;
                    session.selectedVariantName = resolvedVariant === null || resolvedVariant === void 0 ? void 0 : resolvedVariant.name;
                    // Si el cliente pidi├│ por peso (ej: "4 kilos"), convertir a unidades
                    // usando el peso de la variante (ej: MEDIO KILO = 500g ÔåÆ 4000g / 500g = 8 uds)
                    const requestedGramsInSelection = this.detectRequestedWeightGrams(normalizedText);
                    let primaryItemQty;
                    let primaryRequestedQty;
                    let primaryCappedQty;
                    // Agregar cada producto seleccionado al carrito con su cantidad individual
                    for (let i = 0; i < selectedItems.length; i++) {
                        const item = selectedItems[i];
                        const itemVariantHint = i === 0 ? aiVariantHint : undefined;
                        const itemVariant = i === 0
                            ? resolvedVariant
                            : this.resolveVariant(item, itemVariantHint, normalizedText);
                        // Cantidad: si hay quantities[] usamos la de este ├¡ndice;
                        // si hay una sola aiQuantity la usamos para todos;
                        // si el producto tiene solo 1 unidad disponible, forzamos 1.
                        const itemTotalQty = (itemVariant ? [itemVariant] : item.variants).reduce((sum, v) => sum + v.totalQty, 0);
                        // Conversi├│n pesoÔåÆunidades (igual que en edit_cart y product_followup)
                        const variantGramsForItem = itemVariant
                            ? this.parseVariantWeightGrams(itemVariant.name)
                            : null;
                        const weightBasedQty = requestedGramsInSelection !== null && variantGramsForItem !== null
                            ? Math.ceil(requestedGramsInSelection / variantGramsForItem)
                            : undefined;
                        const itemQty = (_u = (_t = weightBasedQty !== null && weightBasedQty !== void 0 ? weightBasedQty : aiQuantities === null || aiQuantities === void 0 ? void 0 : aiQuantities[i]) !== null && _t !== void 0 ? _t : aiQuantity) !== null && _u !== void 0 ? _u : (itemTotalQty === 1 ? 1 : undefined);
                        // Limitar al stock disponible
                        const cappedQty = itemQty !== undefined ? Math.min(itemQty, itemTotalQty) : undefined;
                        const stockExceededForItem = itemQty !== undefined &&
                            cappedQty !== undefined &&
                            cappedQty < itemQty;
                        if (i === 0) {
                            primaryCappedQty = cappedQty;
                            primaryItemQty = stockExceededForItem ? undefined : cappedQty;
                            primaryRequestedQty = stockExceededForItem ? itemQty : undefined;
                        }
                        // Solo agregar al carrito si el stock alcanza para lo pedido
                        if (cappedQty && !stockExceededForItem) {
                            this.addToCart(session, item, cappedQty, currency, itemVariant);
                        }
                    }
                    yield redis_1.redis.set(`session:${phoneNumber}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
                    const selectedProductForReply = resolvedVariant
                        ? Object.assign(Object.assign({}, selectedItems[0]), { variants: [resolvedVariant] }) : selectedItems[0];
                    // Construir items con variantes resueltas para multi-selecci├│n
                    const resolvedSelectedItems = selectedItems.length > 1
                        ? selectedItems.map((item, i) => {
                            const hint = i === 0 ? aiVariantHint : undefined;
                            const v = i === 0
                                ? resolvedVariant
                                : this.resolveVariant(item, hint, normalizedText);
                            return v ? Object.assign(Object.assign({}, item), { variants: [v] }) : item;
                        })
                        : undefined;
                    replyText = yield this.openai
                        .generateReply({
                        userMessage: text,
                        selectedProduct: selectedProductForReply,
                        selectedProducts: resolvedSelectedItems,
                        quantity: aiQuantities
                            ? undefined
                            : (primaryItemQty !== null && primaryItemQty !== void 0 ? primaryItemQty : primaryCappedQty),
                        requestedQuantity: primaryRequestedQty,
                        currency,
                    })
                        .catch(() => this.buildSelectionReply(selectedProductForReply, currency));
                }
                else {
                    const count = session.lastProductList.length;
                    replyText = `Solo tengo ${count} opci├│n${count !== 1 ? 'es' : ''} en la lista. Dime un n├║mero del 1 al ${count}.`;
                }
            }
            else if (intent === 'search_product') {
                session.selectedProduct = undefined;
                const result = yield this.buildProductReply(normalizedText, countryInfo, aiSearchQuery);
                console.log('result *******************************', result);
                session.lastProductList = result.products;
                session.remainingProductList = result.remainingProducts;
                session.awaitingMoreProducts = result.remainingProducts.length > 0;
                session.lastSearchQuery = aiSearchQuery !== null && aiSearchQuery !== void 0 ? aiSearchQuery : normalizedText;
                session.lastCountryInfo = countryInfo;
                const currency = (_v = countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _v !== void 0 ? _v : 'USD';
                // Auto-agregar al carrito si se mencion├│ cantidad y el producto es inequ├¡voco.
                // Aplica cuando el cliente pide directamente un producto con cantidad pero no estaba
                // en el carrito (ej: "Necesito 4 kilos de cera de palma" reclasificado de edit_cart).
                let autoAddedProduct;
                let autoAddedQty;
                let autoAddedVariant;
                let autoAddedRequestedQty;
                let autoAddedStockExceededNote;
                if (aiQuantity !== undefined &&
                    result.products.length === 1 &&
                    result.productFound) {
                    const product = result.products[0];
                    const requestedGrams = this.detectRequestedWeightGrams(normalizedText);
                    if (requestedGrams !== null) {
                        // Cantidad expresada en peso (ej: "4 kilos") ÔåÆ elegir variante ├│ptima
                        const resolved = this.resolveVariantByWeight(product.variants, requestedGrams);
                        if (resolved) {
                            const cappedUnits = Math.min(resolved.units, resolved.variant.totalQty);
                            const stockExceeded = cappedUnits < resolved.units;
                            if (!stockExceeded) {
                                this.addToCart(session, product, cappedUnits, currency, resolved.variant);
                            }
                            session.selectedProduct = product.name;
                            session.selectedVariantName = resolved.variant.name;
                            autoAddedProduct = product;
                            autoAddedQty = cappedUnits;
                            autoAddedVariant = resolved.variant;
                            if (stockExceeded) {
                                const variantGrams = this.parseVariantWeightGrams(resolved.variant.name);
                                const requestedKg = requestedGrams / 1000;
                                const availableGrams = variantGrams !== null ? cappedUnits * variantGrams : null;
                                const availableKg = availableGrams !== null ? availableGrams / 1000 : null;
                                const availableLabel = availableKg !== null
                                    ? `${availableKg % 1 === 0 ? availableKg : availableKg.toFixed(1)} kg (${cappedUnits} unidades de ${resolved.variant.name})`
                                    : `${cappedUnits} unidades de ${resolved.variant.name}`;
                                const requestedLabel = `${requestedKg % 1 === 0 ? requestedKg : requestedKg.toFixed(1)} kg`;
                                autoAddedStockExceededNote = `El cliente pidi├│ ${requestedLabel} pero solo hay ${availableLabel} disponible(s). NO confirmes el pedido ni calcules total. Informa brevemente la cantidad disponible en kg y pregunta si quiere esa cantidad. Var├¡a la frase: "Solo tenemos X kg, ┬┐quieres esas?" u otra variaci├│n natural. NUNCA uses frases como "te lo llevo", "te la llevo" ni similares.`;
                                session.pendingStockConfirmQty = cappedUnits;
                            }
                            console.log(`[WhatsApp Agent] Auto-added to cart from search (weight): ${product.name} ÔÇô ${resolved.variant.name} x${cappedUnits} (${requestedGrams}g ÔåÆ ${resolved.units} units, capped: ${cappedUnits})`);
                        }
                    }
                    else if (product.variants.length === 1) {
                        // Producto con una sola variante ÔåÆ agregar directamente
                        const variant = product.variants[0];
                        const cappedUnits = Math.min(aiQuantity, variant.totalQty);
                        const stockExceeded = cappedUnits < aiQuantity;
                        if (!stockExceeded) {
                            this.addToCart(session, product, cappedUnits, currency, variant);
                        }
                        session.selectedProduct = product.name;
                        session.selectedVariantName = variant.name;
                        autoAddedProduct = product;
                        autoAddedQty = cappedUnits;
                        autoAddedVariant = variant;
                        if (stockExceeded) {
                            autoAddedRequestedQty = aiQuantity;
                            session.pendingStockConfirmQty = cappedUnits;
                        }
                        console.log(`[WhatsApp Agent] Auto-added to cart from search (single variant): ${product.name} ÔÇô ${variant.name} x${cappedUnits}`);
                    }
                    else if (aiVariantHint) {
                        // M├║ltiples variantes + hint de presentaci├│n ÔåÆ resolver y agregar directamente
                        const resolved = this.resolveVariant(product, aiVariantHint, normalizedText);
                        if (resolved) {
                            const cappedUnits = Math.min(aiQuantity, resolved.totalQty);
                            const stockExceeded = cappedUnits < aiQuantity;
                            if (!stockExceeded) {
                                this.addToCart(session, product, cappedUnits, currency, resolved);
                            }
                            session.selectedProduct = product.name;
                            session.selectedVariantName = resolved.name;
                            autoAddedProduct = product;
                            autoAddedQty = cappedUnits;
                            autoAddedVariant = resolved;
                            if (stockExceeded) {
                                autoAddedRequestedQty = aiQuantity;
                                session.pendingStockConfirmQty = cappedUnits;
                            }
                            console.log(`[WhatsApp Agent] Auto-added to cart from search (variant hint "${aiVariantHint}"): ${product.name} ÔÇô ${resolved.name} x${cappedUnits}`);
                        }
                    }
                    // Si hay m├║ltiples variantes sin coincidencia de peso ni hint ÔåÆ no auto-agregar,
                    // mostrar opciones al cliente para que elija.
                }
                yield redis_1.redis.set(`session:${phoneNumber}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
                if (autoAddedProduct && autoAddedQty !== undefined) {
                    const productForReply = autoAddedVariant
                        ? Object.assign(Object.assign({}, autoAddedProduct), { variants: [autoAddedVariant] }) : autoAddedProduct;
                    replyText = yield this.openai
                        .generateReply({
                        userMessage: text,
                        selectedProduct: productForReply,
                        quantity: autoAddedQty,
                        requestedQuantity: autoAddedRequestedQty,
                        stockExceededNote: autoAddedStockExceededNote,
                        currency,
                    })
                        .catch(() => result.replyText);
                }
                else {
                    replyText = yield this.openai
                        .generateReply({
                        userMessage: text,
                        products: result.products.length > 0 ? result.products : undefined,
                        hasMoreProducts: result.remainingProducts.length > 0,
                        isFirstInteraction,
                        currency,
                        outOfStockProductName: result.outOfStockProductName,
                    })
                        .catch(() => result.replyText);
                }
                // Log detallado de productos devueltos
                try {
                    console.log('[WhatsApp Agent] Productos devueltos al cliente:', ((_w = result.products) !== null && _w !== void 0 ? _w : []).map(p => ({
                        id: p.productId,
                        nombre: p.name,
                        descripcion: p.description,
                        variantes: p.variants.map(v => ({
                            id: v.variantId,
                            nombre: v.name,
                            stock: v.totalQty,
                            precio: v.price,
                        })),
                    })));
                }
                catch (e) {
                    console.error('[WhatsApp Agent] Error loggeando productos devueltos:', e);
                }
                this.logService
                    .logQuery({
                    phoneNumber,
                    botPhoneNumberId,
                    rawText: text,
                    searchTerms: result.searchTerms,
                    productFound: result.productFound,
                    suggestionsShown: result.suggestionsShown,
                    replyText,
                    countryPrefix,
                })
                    .catch(err => {
                    console.error('[WhatsApp Agent] Error saving query log:', err);
                    this.logService
                        .logError({
                        context: 'logQuery',
                        error: err,
                        phoneNumber,
                        rawText: text,
                    })
                        .catch(e => console.error('[WhatsApp Agent] Failed to save error log:', e));
                });
            }
            else if (intent === 'show_more') {
                const currency = (_z = (_y = (_x = session.lastCountryInfo) === null || _x === void 0 ? void 0 : _x.currency) !== null && _y !== void 0 ? _y : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _z !== void 0 ? _z : 'USD';
                if (session.awaitingMoreProducts) {
                    const nextBatch = ((_0 = session.remainingProductList) !== null && _0 !== void 0 ? _0 : []).slice(0, MAX_PRODUCT_RESULTS);
                    const newRemaining = ((_1 = session.remainingProductList) !== null && _1 !== void 0 ? _1 : []).slice(MAX_PRODUCT_RESULTS);
                    session.lastProductList = [
                        ...((_2 = session.lastProductList) !== null && _2 !== void 0 ? _2 : []),
                        ...nextBatch,
                    ];
                    session.remainingProductList = newRemaining;
                    session.awaitingMoreProducts = newRemaining.length > 0;
                    yield redis_1.redis.set(`session:${phoneNumber}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
                    replyText = yield this.openai
                        .generateReply({
                        userMessage: text,
                        products: nextBatch,
                        hasMoreProducts: newRemaining.length > 0,
                        isShowingMore: true,
                        currency,
                    })
                        .catch(() => 'Aqu├¡ hay m├ís opciones, dime cu├íl te interesa.');
                }
                else if (session.lastSearchQuery) {
                    // No hay productos en cola pero s├¡ hubo una b├║squeda previa: rehacer con query limpio
                    session.selectedProduct = undefined;
                    const result = yield this.buildProductReply((0, utils_1.normalizeText)(session.lastSearchQuery), (_3 = countryInfo !== null && countryInfo !== void 0 ? countryInfo : session.lastCountryInfo) !== null && _3 !== void 0 ? _3 : null, session.lastSearchQuery);
                    session.lastProductList = result.products;
                    session.remainingProductList = result.remainingProducts;
                    session.awaitingMoreProducts = result.remainingProducts.length > 0;
                    session.lastCountryInfo =
                        (_4 = countryInfo !== null && countryInfo !== void 0 ? countryInfo : session.lastCountryInfo) !== null && _4 !== void 0 ? _4 : null;
                    yield redis_1.redis.set(`session:${phoneNumber}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
                    replyText = yield this.openai
                        .generateReply({
                        userMessage: text,
                        products: result.products.length > 0 ? result.products : undefined,
                        hasMoreProducts: result.remainingProducts.length > 0,
                        isShowingMore: true,
                        currency,
                    })
                        .catch(() => result.replyText);
                }
                else {
                    replyText =
                        'No tengo m├ís opciones disponibles en este momento. ┬┐Puedo ayudarte con otra cosa?';
                }
            }
            else if (intent === 'objection') {
                const currency = (_7 = (_6 = (_5 = session.lastCountryInfo) === null || _5 === void 0 ? void 0 : _5.currency) !== null && _6 !== void 0 ? _6 : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _7 !== void 0 ? _7 : 'USD';
                const selectedProductEntry = (_8 = session.lastProductList) === null || _8 === void 0 ? void 0 : _8.find(p => p.name === session.selectedProduct);
                replyText = yield this.openai
                    .generateReply({
                    userMessage: text,
                    intent: 'objection',
                    selectedProduct: selectedProductEntry,
                    products: ((_9 = session.lastProductList) === null || _9 === void 0 ? void 0 : _9.length)
                        ? session.lastProductList
                        : undefined,
                    currency,
                })
                    .catch(() => 'Sin problema, aqu├¡ estar├® cuando lo necesites. ­ƒÖî');
            }
            else if (intent === 'affirmation') {
                const currency = (_12 = (_11 = (_10 = session.lastCountryInfo) === null || _10 === void 0 ? void 0 : _10.currency) !== null && _11 !== void 0 ? _11 : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _12 !== void 0 ? _12 : 'USD';
                // Si hay un producto en contexto (seleccionado o ├║nico en la lista), tratar como confirmaci├│n de compra
                const affirmationProduct = session.selectedProduct
                    ? (_13 = session.lastProductList) === null || _13 === void 0 ? void 0 : _13.find(p => p.name === session.selectedProduct)
                    : ((_14 = session.lastProductList) === null || _14 === void 0 ? void 0 : _14.length) === 1
                        ? session.lastProductList[0]
                        : undefined;
                if (affirmationProduct) {
                    if (!session.selectedProduct) {
                        session.selectedProduct = affirmationProduct.name;
                    }
                    const sessionVariantAff = session.selectedVariantName
                        ? affirmationProduct.variants.find(v => v.name === session.selectedVariantName)
                        : undefined;
                    const relevantVariants = sessionVariantAff
                        ? [sessionVariantAff]
                        : affirmationProduct.variants;
                    const totalQtyAff = relevantVariants.reduce((sum, v) => sum + v.totalQty, 0);
                    const impliedQty = totalQtyAff === 1 ? 1 : undefined;
                    const bareNumberQtyAff = /^\d+$/.test(normalizedText.trim())
                        ? parseInt(normalizedText.trim(), 10)
                        : undefined;
                    // Extrae cantidad del texto completo cuando el intent fue determin├¡stico
                    // (aiQuantity no disponible) p. ej. "s├¡, dame 5"
                    const inlineQtyMatch = /\b(\d+)\b/.exec(normalizedText);
                    const inlineQty = inlineQtyMatch
                        ? parseInt(inlineQtyMatch[1], 10)
                        : undefined;
                    const pendingQty = session.pendingStockConfirmQty;
                    if (pendingQty !== undefined)
                        session.pendingStockConfirmQty = undefined;
                    const effectiveQtyAff = (_17 = (_16 = (_15 = aiQuantity !== null && aiQuantity !== void 0 ? aiQuantity : bareNumberQtyAff) !== null && _15 !== void 0 ? _15 : inlineQty) !== null && _16 !== void 0 ? _16 : impliedQty) !== null && _17 !== void 0 ? _17 : pendingQty;
                    if (effectiveQtyAff) {
                        this.addToCart(session, affirmationProduct, effectiveQtyAff, currency, sessionVariantAff);
                    }
                    yield redis_1.redis.set(`session:${phoneNumber}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
                    const productForAffReply = sessionVariantAff
                        ? Object.assign(Object.assign({}, affirmationProduct), { variants: [sessionVariantAff] }) : affirmationProduct;
                    replyText = yield this.openai
                        .generateReply({
                        userMessage: text,
                        selectedProduct: productForAffReply,
                        quantity: effectiveQtyAff,
                        lastBotMessage: session.lastBotMessage,
                        currency,
                    })
                        .catch(() => 'Claro, ┬┐en qu├® te puedo ayudar?');
                }
                else {
                    replyText = yield this.openai
                        .generateReply({
                        userMessage: text,
                        intent: 'affirmation',
                        lastBotMessage: session.lastBotMessage,
                        products: ((_18 = session.lastProductList) === null || _18 === void 0 ? void 0 : _18.length)
                            ? session.lastProductList
                            : undefined,
                        currency,
                    })
                        .catch(() => 'Claro, ┬┐en qu├® te puedo ayudar?');
                }
            }
            else if (intent === 'general_question') {
                replyText = yield this.openai
                    .generateReply({
                    userMessage: text,
                    intent: 'general_question',
                    isFirstInteraction,
                })
                    .catch(() => 'Para esa consulta te recomiendo hablar directamente con nuestro equipo. ┬┐Te ayudo con algo m├ís?');
            }
            else if (intent === 'product_followup') {
                // El cliente ya eligi├│ un producto ÔÇö continuar la conversaci├│n con ese contexto
                const selectedProductEntry = (_19 = session.lastProductList) === null || _19 === void 0 ? void 0 : _19.find(p => p.name === session.selectedProduct);
                const currency = (_22 = (_21 = (_20 = session.lastCountryInfo) === null || _20 === void 0 ? void 0 : _20.currency) !== null && _21 !== void 0 ? _21 : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _22 !== void 0 ? _22 : 'USD';
                const sessionVariant = selectedProductEntry && session.selectedVariantName
                    ? selectedProductEntry.variants.find(v => v.name === session.selectedVariantName)
                    : undefined;
                const productForReply = selectedProductEntry && sessionVariant
                    ? Object.assign(Object.assign({}, selectedProductEntry), { variants: [sessionVariant] }) : selectedProductEntry;
                if (selectedProductEntry) {
                    const totalQtyFollowup = (sessionVariant ? [sessionVariant] : selectedProductEntry.variants).reduce((sum, v) => sum + v.totalQty, 0);
                    const bareNumberQtyFollowup = /^\d+$/.test(normalizedText.trim())
                        ? parseInt(normalizedText.trim(), 10)
                        : undefined;
                    const effectiveQtyFollowup = (_23 = aiQuantity !== null && aiQuantity !== void 0 ? aiQuantity : bareNumberQtyFollowup) !== null && _23 !== void 0 ? _23 : (totalQtyFollowup === 1 ? 1 : undefined);
                    // Limitar al stock disponible
                    const cappedQtyFollowup = effectiveQtyFollowup !== undefined
                        ? Math.min(effectiveQtyFollowup, totalQtyFollowup)
                        : undefined;
                    const requestedQtyFollowup = effectiveQtyFollowup !== undefined &&
                        cappedQtyFollowup !== undefined &&
                        cappedQtyFollowup < effectiveQtyFollowup
                        ? effectiveQtyFollowup
                        : undefined;
                    // Solo agregar al carrito si el stock alcanza para lo pedido
                    if (cappedQtyFollowup && !requestedQtyFollowup) {
                        this.addToCart(session, selectedProductEntry, cappedQtyFollowup, currency, sessionVariant);
                    }
                    replyText = yield this.openai
                        .generateReply({
                        userMessage: text,
                        selectedProduct: productForReply,
                        lastBotMessage: session.lastBotMessage,
                        quantity: cappedQtyFollowup,
                        requestedQuantity: requestedQtyFollowup,
                        currency,
                    })
                        .catch(() => 'Claro, ┬┐en qu├® m├ís te puedo ayudar?');
                }
                else {
                    replyText = yield this.openai
                        .generateReply({
                        userMessage: text,
                        selectedProduct: productForReply,
                        lastBotMessage: session.lastBotMessage,
                        quantity: aiQuantity,
                        currency,
                    })
                        .catch(() => 'Claro, ┬┐en qu├® m├ís te puedo ayudar?');
                }
            }
            else if (intent === 'edit_cart') {
                console.log(`[WhatsApp Agent] === EDIT_CART HANDLER === addHint: ${aiAddProductHint}, qty: ${aiQuantity}, removeHint: ${aiRemoveProductHint}, cartEdits: ${JSON.stringify(aiCartEdits)}`);
                const currency = (_26 = (_25 = (_24 = session.lastCountryInfo) === null || _24 === void 0 ? void 0 : _24.currency) !== null && _25 !== void 0 ? _25 : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _26 !== void 0 ? _26 : 'USD';
                let removedProductName;
                let addedProductEntry;
                let addedQty;
                let updatedCartItemKey;
                // Shared helper: token-based cart item name matcher
                const buildCartMatcher = (hint) => {
                    const tokens = (0, utils_1.normalizeText)(hint).split(/\s+/);
                    const ids = tokens.filter(t => /\d/.test(t));
                    const words = tokens.filter(t => !/\d/.test(t) && t.length > 2);
                    return (fullName) => {
                        const idMatch = ids.length === 0 || ids.every(t => fullName.includes(t));
                        const wordMatch = words.length === 0 || words.some(t => fullName.includes(t));
                        return (ids.length > 0 || words.length > 0) && idMatch && wordMatch;
                    };
                };
                const cartFullName = (item) => (0, utils_1.normalizeText)(item.variantName
                    ? `${item.productName} ${item.variantName}`
                    : item.productName);
                // Mejor coincidencia por puntaje: elige el item del carrito cuyas palabras
                // del hint aparecen en mayor cantidad en el nombre ÔÇö evita falsos positivos.
                const findBestCartItemByHint = (hint) => {
                    var _a;
                    const htokens = (0, utils_1.normalizeText)(hint).split(/\s+/);
                    const hids = htokens.filter(t => /\d/.test(t));
                    const hwords = htokens.filter(t => !/\d/.test(t) && t.length > 2);
                    if (!((_a = session.cart) === null || _a === void 0 ? void 0 : _a.length) || (hids.length === 0 && hwords.length === 0))
                        return undefined;
                    let best;
                    let bestScore = 0;
                    for (const item of session.cart) {
                        const fullName = cartFullName(item);
                        if (hids.length > 0 && !hids.every(t => fullName.includes(t)))
                            continue;
                        const score = hwords.filter(t => fullName.includes(t)).length;
                        if (score > bestScore) {
                            bestScore = score;
                            best = item;
                        }
                    }
                    return bestScore > 0 ? best : undefined;
                };
                // Detectar si el mensaje implica incremento de cantidad (reutilizable en PASO A y C)
                const isIncrement = /\b(agrega[r]?(?:s|as)?|agregu[├®e][ns]?|a[n├▒]ade[r]?(?:s|as)?|a[n├▒]adi[r├│]|sum[ae][r]?(?:s|as)?|sumemos)\b/i.test(normalizedText) ||
                    /\botr[ao]\b/i.test(normalizedText) ||
                    /\d+\s*(?:kilo[s]?|kg|unidades?|u)?\.?\s+mas\b/i.test(normalizedText) ||
                    /\bmas\s+de\b/i.test(normalizedText);
                // PASO A) Agregar/actualizar cantidad de producto en carrito (primero)
                // Se salta si hay cartEdits ÔÇö PASO C maneja todo en ese caso.
                if (aiAddProductHint && !(aiCartEdits && aiCartEdits.length > 0)) {
                    const normalizedHint = (0, utils_1.normalizeText)(aiAddProductHint);
                    const hintWords = normalizedHint
                        .split(/\s+/)
                        .filter(t => !/\d/.test(t) && t.length > 2);
                    const requestedGrams = this.detectRequestedWeightGrams(normalizedText);
                    // Buscar el item del carrito con mayor coincidencia sem├íntica con el hint
                    const cartItemToUpdate = findBestCartItemByHint(aiAddProductHint);
                    console.log(`[WhatsApp Agent] edit_cart match: hint="${aiAddProductHint}", matched="${(_27 = cartItemToUpdate === null || cartItemToUpdate === void 0 ? void 0 : cartItemToUpdate.productName) !== null && _27 !== void 0 ? _27 : 'NONE'}${(cartItemToUpdate === null || cartItemToUpdate === void 0 ? void 0 : cartItemToUpdate.variantName) ? ` ${cartItemToUpdate.variantName}` : ''}", prevQty=${(_28 = cartItemToUpdate === null || cartItemToUpdate === void 0 ? void 0 : cartItemToUpdate.quantity) !== null && _28 !== void 0 ? _28 : 'N/A'}, isIncrement=${isIncrement}, aiQty=${aiQuantity}`);
                    if (cartItemToUpdate) {
                        // Calcular unidades pedidas
                        if (requestedGrams !== null && cartItemToUpdate.variantName) {
                            const variantGrams = this.parseVariantWeightGrams(cartItemToUpdate.variantName);
                            if (variantGrams !== null) {
                                addedQty = Math.ceil(requestedGrams / variantGrams);
                            }
                        }
                        addedQty !== null && addedQty !== void 0 ? addedQty : (addedQty = aiQuantity !== null && aiQuantity !== void 0 ? aiQuantity : 1);
                        const prevQty = cartItemToUpdate.quantity;
                        cartItemToUpdate.quantity = isIncrement
                            ? prevQty + addedQty
                            : addedQty;
                        updatedCartItemKey =
                            (_29 = cartItemToUpdate.productVariantId) !== null && _29 !== void 0 ? _29 : cartItemToUpdate.productId;
                        console.log(`[WhatsApp Agent] Cart qty ${isIncrement ? 'increased' : 'set'}: ` +
                            `${cartItemToUpdate.productName} x${cartItemToUpdate.quantity}`);
                        // Construir addedProductEntry para el reply
                        addedProductEntry = (_31 = (_30 = session.lastProductList) === null || _30 === void 0 ? void 0 : _30.find(p => p.productId === cartItemToUpdate.productId)) !== null && _31 !== void 0 ? _31 : {
                            productId: cartItemToUpdate.productId,
                            name: cartItemToUpdate.productName,
                            variants: cartItemToUpdate.productVariantId
                                ? [
                                    {
                                        variantId: cartItemToUpdate.productVariantId,
                                        stockItemId: (_32 = cartItemToUpdate.stockItemId) !== null && _32 !== void 0 ? _32 : null,
                                        name: (_33 = cartItemToUpdate.variantName) !== null && _33 !== void 0 ? _33 : '',
                                        totalQty: 0,
                                        price: cartItemToUpdate.unitPrice,
                                    },
                                ]
                                : [],
                        };
                        // Para el reply usar la cantidad final del carrito
                        addedQty = cartItemToUpdate.quantity;
                    }
                    else {
                        // Producto no est├í en el carrito ÔåÆ buscarlo en lastProductList para agregarlo
                        addedProductEntry =
                            (_35 = (_34 = session.lastProductList) === null || _34 === void 0 ? void 0 : _34.find(p => (0, utils_1.normalizeText)(p.name).includes(normalizedHint) ||
                                hintWords.some(t => (0, utils_1.normalizeText)(p.name).includes(t)))) !== null && _35 !== void 0 ? _35 : undefined;
                        if (addedProductEntry) {
                            if (requestedGrams !== null) {
                                const variantWeights = addedProductEntry.variants
                                    .map(v => ({
                                    variant: v,
                                    grams: this.parseVariantWeightGrams(v.name),
                                }))
                                    .filter((vw) => vw.grams !== null);
                                if (variantWeights.length > 0) {
                                    const largest = variantWeights.reduce((a, b) => b.grams > a.grams ? b : a);
                                    addedQty = Math.ceil(requestedGrams / largest.grams);
                                    session.selectedVariantName = largest.variant.name;
                                }
                            }
                            addedQty !== null && addedQty !== void 0 ? addedQty : (addedQty = aiQuantity !== null && aiQuantity !== void 0 ? aiQuantity : 1);
                            const resolvedVariant = session.selectedVariantName
                                ? addedProductEntry.variants.find(v => v.name === session.selectedVariantName)
                                : addedProductEntry.variants.length === 1
                                    ? addedProductEntry.variants[0]
                                    : undefined;
                            this.addToCart(session, addedProductEntry, addedQty, currency, resolvedVariant);
                        }
                    }
                }
                // PASO B) Eliminar producto del carrito (segundo ÔÇö omitir si mismo item fue actualizado en Paso A)
                if (aiRemoveProductHint && ((_36 = session.cart) === null || _36 === void 0 ? void 0 : _36.length)) {
                    const bestRemoveItem = findBestCartItemByHint(aiRemoveProductHint);
                    const idx = bestRemoveItem ? session.cart.indexOf(bestRemoveItem) : -1;
                    if (idx !== -1) {
                        const target = session.cart[idx];
                        const targetKey = (_37 = target.productVariantId) !== null && _37 !== void 0 ? _37 : target.productId;
                        if (targetKey === updatedCartItemKey) {
                            // Mismo item ÔåÆ fue un cambio de cantidad, no una eliminaci├│n
                            console.log(`[WhatsApp Agent] Cart remove skipped (qty update): ${target.productName}`);
                        }
                        else {
                            removedProductName = target.variantName
                                ? `${target.productName} ${target.variantName}`
                                : target.productName;
                            session.cart.splice(idx, 1);
                            console.log(`[WhatsApp Agent] Cart remove: ${removedProductName}`);
                        }
                    }
                }
                // PASO C) Actualizar cantidad de productos del carrito v├¡a cartEdits
                if (aiCartEdits && aiCartEdits.length > 0) {
                    for (const edit of aiCartEdits) {
                        const target = findBestCartItemByHint(edit.productHint);
                        if (target) {
                            const prevQty = target.quantity;
                            target.quantity = isIncrement
                                ? prevQty + edit.quantity
                                : edit.quantity;
                            console.log(`[WhatsApp Agent] Cart edit: ${target.productName}${target.variantName ? ` ${target.variantName}` : ''} ${isIncrement ? `${prevQty}+${edit.quantity}` : `set`}=${target.quantity}`);
                            // Para el reply, usar el ├║ltimo producto editado
                            addedProductEntry = (_39 = (_38 = session.lastProductList) === null || _38 === void 0 ? void 0 : _38.find(p => p.productId === target.productId)) !== null && _39 !== void 0 ? _39 : {
                                productId: target.productId,
                                name: target.productName,
                                variants: target.productVariantId
                                    ? [
                                        {
                                            variantId: target.productVariantId,
                                            stockItemId: (_40 = target.stockItemId) !== null && _40 !== void 0 ? _40 : null,
                                            name: (_41 = target.variantName) !== null && _41 !== void 0 ? _41 : '',
                                            totalQty: 0,
                                            price: target.unitPrice,
                                        },
                                    ]
                                    : [],
                            };
                            addedQty = target.quantity;
                        }
                    }
                    // Con m├║ltiples edits (2+), limpiar para que reply reciba carrito completo
                    if (aiCartEdits.length > 1) {
                        addedProductEntry = undefined;
                        addedQty = undefined;
                    }
                }
                replyText = yield this.openai
                    .generateReply({
                    userMessage: text,
                    intent: 'edit_cart',
                    cart: session.cart,
                    currency,
                    removedProduct: removedProductName,
                    addedProduct: addedProductEntry
                        ? {
                            name: addedProductEntry.name,
                            variants: addedProductEntry.variants,
                        }
                        : undefined,
                    addedQuantity: addedQty,
                })
                    .then(reply => {
                    var _a;
                    console.log(`[WhatsApp Agent] edit_cart final: addedQty=${addedQty}, product=${(_a = addedProductEntry === null || addedProductEntry === void 0 ? void 0 : addedProductEntry.name) !== null && _a !== void 0 ? _a : 'NONE'}, reply=${reply.substring(0, 80)}`);
                    return reply;
                })
                    .catch(() => 'Listo, actualic├® tu pedido. ┬┐Necesitas algo m├ís?');
                if (((_42 = session.pendingQuoteFlow) === null || _42 === void 0 ? void 0 : _42.step) === 'awaiting_cart_confirmation') {
                    replyText += '\n\n┬┐Quieres que te genere la cotizaci├│n?';
                }
            }
            else if (intent === 'show_cart') {
                const currency = (_45 = (_44 = (_43 = session.lastCountryInfo) === null || _43 === void 0 ? void 0 : _43.currency) !== null && _44 !== void 0 ? _44 : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _45 !== void 0 ? _45 : 'USD';
                replyText = yield this.openai
                    .generateReply({
                    userMessage: text,
                    intent: 'show_cart',
                    cart: session.cart,
                    currency,
                })
                    .catch(() => 'No tienes productos en tu pedido todav├¡a.');
            }
            else if (intent === 'request_quote') {
                // Procesar lista de productos si viene en el mensaje
                let outOfStockFromList = [];
                let outOfStockDetailsFromList = [];
                if (aiProductList && aiProductList.length > 0) {
                    const currency = (_48 = (_47 = (_46 = session.lastCountryInfo) === null || _46 === void 0 ? void 0 : _46.currency) !== null && _47 !== void 0 ? _47 : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _48 !== void 0 ? _48 : 'USD';
                    const listResult = yield this.processProductListItems(aiProductList, session, currency, countryInfo, 'quote');
                    outOfStockFromList = listResult.outOfStock;
                    outOfStockDetailsFromList = listResult.outOfStockDetails;
                    console.log(`[WhatsApp Agent] Processed product list for quote: ${(_50 = (_49 = session.cart) === null || _49 === void 0 ? void 0 : _49.length) !== null && _50 !== void 0 ? _50 : 0} items added to cart`);
                }
                // Si el mensaje tra├¡a UN SOLO producto (el AI clasific├│ como request_quote pero
                // el cliente probablemente a├║n no termin├│ de pedir), tratarlo como un add-to-cart
                // normal: confirmar el producto y preguntar si necesita algo m├ís.
                // Solo se muestra el resumen completo cuando hay 2+ productos en la lista
                // o cuando el cliente pidi├│ la cotizaci├│n de forma expl├¡cita (sin productList).
                const isSingleProductFromList = aiProductList !== undefined && aiProductList.length === 1;
                if (!session.cart || session.cart.length === 0) {
                    replyText =
                        'Todav├¡a no tienes productos en tu pedido. Primero agrega lo que necesites y luego te armo la cotizaci├│n.';
                }
                else if (isSingleProductFromList) {
                    // Un solo producto reci├®n agregado ÔåÆ comportamiento igual a add-to-cart normal
                    const currency = (_53 = (_52 = (_51 = session.lastCountryInfo) === null || _51 === void 0 ? void 0 : _51.currency) !== null && _52 !== void 0 ? _52 : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _53 !== void 0 ? _53 : 'USD';
                    const lastCartItem = session.cart[session.cart.length - 1];
                    const foundInList = (_54 = session.lastProductList) === null || _54 === void 0 ? void 0 : _54.find(p => p.name === (lastCartItem === null || lastCartItem === void 0 ? void 0 : lastCartItem.productName));
                    const foundVariant = foundInList === null || foundInList === void 0 ? void 0 : foundInList.variants.find(v => v.name === (lastCartItem === null || lastCartItem === void 0 ? void 0 : lastCartItem.variantName));
                    const productForReply = foundInList && foundVariant
                        ? Object.assign(Object.assign({}, foundInList), { variants: [foundVariant] }) : (foundInList !== null && foundInList !== void 0 ? foundInList : {
                        name: (_55 = lastCartItem === null || lastCartItem === void 0 ? void 0 : lastCartItem.productName) !== null && _55 !== void 0 ? _55 : '',
                        description: undefined,
                        variants: (lastCartItem === null || lastCartItem === void 0 ? void 0 : lastCartItem.variantName)
                            ? [
                                {
                                    name: lastCartItem.variantName,
                                    price: (_56 = lastCartItem.unitPrice) !== null && _56 !== void 0 ? _56 : '0',
                                    totalQty: lastCartItem.quantity,
                                },
                            ]
                            : [],
                    });
                    yield redis_1.redis.set(`session:${phoneNumber}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
                    replyText = yield this.openai
                        .generateReply({
                        userMessage: text,
                        selectedProduct: productForReply,
                        quantity: lastCartItem === null || lastCartItem === void 0 ? void 0 : lastCartItem.quantity,
                        currency,
                    })
                        .catch(() => { var _a; return `Listo, agregu├® ${(_a = lastCartItem === null || lastCartItem === void 0 ? void 0 : lastCartItem.productName) !== null && _a !== void 0 ? _a : 'el producto'} a tu pedido. ┬┐Necesitas algo m├ís?`; });
                }
                else {
                    const currency = (_59 = (_58 = (_57 = session.lastCountryInfo) === null || _57 === void 0 ? void 0 : _57.currency) !== null && _58 !== void 0 ? _58 : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _59 !== void 0 ? _59 : 'USD';
                    // M├║ltiples productos o cotizaci├│n expl├¡cita ÔåÆ mostrar resumen y confirmar
                    session.pendingQuoteFlow = {
                        step: 'awaiting_cart_confirmation',
                        outOfStockItems: outOfStockFromList.length > 0 ? outOfStockFromList : undefined,
                    };
                    const cartLines = session.cart
                        .map(item => {
                        const name = item.variantName
                            ? `${item.productName} ${item.variantName}`
                            : item.productName;
                        const total = item.unitPrice
                            ? (0, utils_1.formatPrice)(String(Number(item.unitPrice) * item.quantity), item.currency)
                            : null;
                        return total
                            ? `- ${item.quantity}x ${name} = ${total}`
                            : `- ${item.quantity}x ${name}`;
                    })
                        .join('\n');
                    const grandTotal = session.cart.reduce((sum, item) => sum + (item.unitPrice ? Number(item.unitPrice) * item.quantity : 0), 0);
                    const grandTotalFormatted = (0, utils_1.formatPrice)(String(grandTotal), currency);
                    replyText = `Aqu├¡ est├í tu pedido:\n${cartLines}\n\nTotal: ${grandTotalFormatted}`;
                    if (outOfStockDetailsFromList.length > 0) {
                        const lines = outOfStockDetailsFromList
                            .map(p => {
                            const stockNote = p.currentStock > 0
                                ? `solo hay ${p.currentStock} disponible${p.currentStock !== 1 ? 's' : ''}`
                                : 'sin stock';
                            const altNote = p.alternatives.length > 0
                                ? `; tambi├®n disponible en: ${p.alternatives.map(a => `${a.name} (${a.stock})`).join(', ')}`
                                : '';
                            return `- ${p.name} (${stockNote}${altNote})`;
                        })
                            .join('\n');
                        replyText += `\n\nÔÜá´©Å Los siguientes productos no tienen stock suficiente:\n${lines}`;
                    }
                    replyText +=
                        '\n\n┬┐Quieres generar una cotizaci├│n o proceder con la compra?';
                    yield redis_1.redis.set(`session:${phoneNumber}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
                }
            }
            else if (intent === 'purchase_intent') {
                const isoCode = (_62 = (_61 = (_60 = session.lastCountryInfo) === null || _60 === void 0 ? void 0 : _60.isoCode) !== null && _61 !== void 0 ? _61 : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.isoCode) !== null && _62 !== void 0 ? _62 : 'CO';
                const localPhone = this.stripCallingCode(phoneNumber);
                const cartItems = (_63 = session.cart) !== null && _63 !== void 0 ? _63 : [];
                const hasQuote = !!session.lastQuoteId && !!session.lastQuoteSerial;
                const hasCartItems = cartItems.length > 0;
                if (!hasCartItems && !hasQuote) {
                    replyText =
                        'Todav├¡a no tienes productos en tu pedido. Primero agrega lo que necesites y luego te ayudo a completar la compra.';
                }
                else if (hasQuote) {
                    // Proceder directamente con el pago de la cotizaci├│n existente
                    const currency = (_66 = (_65 = (_64 = session.lastCountryInfo) === null || _64 === void 0 ? void 0 : _64.currency) !== null && _65 !== void 0 ? _65 : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _66 !== void 0 ? _66 : 'USD';
                    const flow = {
                        step: 'awaiting_receipt',
                        purchaseFromQuote: true,
                        quoteId: session.lastQuoteId,
                        quoteSerial: session.lastQuoteSerial,
                        currency,
                    };
                    // Cargar items y datos del cliente desde la cotizaci├│n
                    const quoteResult = yield this.quoteService.getOne(session.lastQuoteSerial);
                    if (quoteResult.status === 200 && quoteResult.quote) {
                        const quote = quoteResult.quote;
                        flow.items = ((_67 = quote.quoteItems) !== null && _67 !== void 0 ? _67 : []).map((qi) => ({
                            productId: '',
                            productName: qi.name,
                            quantity: qi.quantity,
                            unitPrice: String(qi.price),
                            currency,
                        }));
                        flow.total = (0, utils_2.calculateTotals)(quote).total;
                        flow.collectedData = {
                            fullName: quote.fullName,
                            dni: quote.dni,
                            phoneNumber: quote.phoneNumber,
                            location: quote.location,
                            cityId: quote.cityId,
                            cityName: quote.cityName
                                ? `${quote.cityName}${quote.regionName ? `, ${quote.regionName}` : ''}`
                                : undefined,
                            customerId: String((_68 = quote.customerId) !== null && _68 !== void 0 ? _68 : ''),
                        };
                    }
                    const paymentRef = crypto_1.default.randomUUID();
                    const paymentLink = yield this.paymentLinkService.getLinkForCountry(isoCode, (_71 = (_69 = flow.total) !== null && _69 !== void 0 ? _69 : (_70 = flow.items) === null || _70 === void 0 ? void 0 : _70.reduce((sum, i) => sum + (i.unitPrice ? parseFloat(i.unitPrice) * i.quantity : 0), 0)) !== null && _71 !== void 0 ? _71 : 0, currency, paymentRef);
                    const provider = this.paymentLinkService.getProviderName(isoCode);
                    flow.paymentRef = paymentRef;
                    flow.paymentLink = paymentLink;
                    session.pendingPurchaseFlow = flow;
                    const itemLines = flow.items && flow.items.length > 0
                        ? flow.items
                            .map((i) => {
                            const name = i.variantName
                                ? `${i.productName} ÔÇô ${i.variantName}`
                                : i.productName;
                            return `  ÔÇó ${i.quantity}x ${name}`;
                        })
                            .join('\n')
                        : '';
                    const totalStr = flow.total != null ? (0, utils_1.formatPrice)(String(flow.total), currency) : '';
                    replyText =
                        `┬íPerfecto! ­ƒÄë Aqu├¡ tienes tu link de pago con ${provider}:\n\n` +
                            `­ƒöù ${paymentLink}\n\n` +
                            (itemLines ? `Pedido:\n${itemLines}\n\n` : '') +
                            (totalStr ? `Total: ${totalStr}\n\n` : '') +
                            `Ref: ${paymentRef}\n\n` +
                            `Cuando realices el pago, env├¡anos el comprobante (imagen o PDF) para que nuestro equipo lo verifique. ­ƒô©`;
                }
                else {
                    // Flujo con el carrito actual
                    const currency = (_74 = (_73 = (_72 = session.lastCountryInfo) === null || _72 === void 0 ? void 0 : _72.currency) !== null && _73 !== void 0 ? _73 : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _74 !== void 0 ? _74 : 'USD';
                    // Verificar stock antes de proceder con la compra
                    const stockIds = (_77 = (_76 = (_75 = session.lastCountryInfo) === null || _75 === void 0 ? void 0 : _75.stockIds) !== null && _76 !== void 0 ? _76 : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.stockIds) !== null && _77 !== void 0 ? _77 : [];
                    const { purchasableItems, blockedItems } = yield this.filterCartItemsByStock(cartItems, stockIds);
                    if (purchasableItems.length === 0) {
                        replyText =
                            'Ninguno de los productos en tu pedido tiene stock suficiente para procesar la compra en este momento. Si quieres, puedo generarte una cotizaci├│n.';
                    }
                    else if (blockedItems.length > 0) {
                        // Hay ├¡tems sin stock suficiente ÔåÆ preguntar al cliente antes de proceder
                        const blockedItemsContext = yield Promise.all(blockedItems.map((blocked) => __awaiter(this, void 0, void 0, function* () {
                            var _a;
                            const availableStock = blocked.stockItemId
                                ? yield this.getAvailableStock(blocked.stockItemId, stockIds)
                                : 0;
                            const productEntry = (_a = session.lastProductList) === null || _a === void 0 ? void 0 : _a.find(p => p.productId === blocked.productId);
                            const alternatives = productEntry
                                ? productEntry.variants
                                    .filter(v => v.variantId !== blocked.productVariantId &&
                                    v.totalQty > 0)
                                    .map(v => ({
                                    variantId: v.variantId,
                                    name: v.name || '',
                                    stock: v.totalQty,
                                    unitPrice: v.price,
                                }))
                                : [];
                            return { item: blocked, availableStock, alternatives };
                        })));
                        session.pendingPurchaseFlow = {
                            step: 'awaiting_out_of_stock_resolution',
                            purchaseFromQuote: false,
                            items: purchasableItems,
                            currency,
                            collectedData: { phoneNumber: localPhone },
                            blockedItemsContext,
                        };
                        replyText =
                            this.buildOutOfStockResolutionMessage(blockedItemsContext);
                    }
                    else {
                        const existingCustomer = yield this.customerService.findByPhone(localPhone, isoCode);
                        if (existingCustomer) {
                            session.pendingPurchaseFlow = {
                                step: 'awaiting_confirmation',
                                purchaseFromQuote: false,
                                items: purchasableItems,
                                currency,
                                collectedData: {
                                    fullName: existingCustomer.fullName,
                                    dni: existingCustomer.dni,
                                    phoneNumber: localPhone,
                                    location: existingCustomer.location,
                                    cityId: existingCustomer.cityId,
                                    cityName: existingCustomer.cityName
                                        ? `${existingCustomer.cityName}${existingCustomer.regionName ? `, ${existingCustomer.regionName}` : ''}`
                                        : undefined,
                                    customerId: existingCustomer.id,
                                    personId: existingCustomer.personId,
                                },
                            };
                            replyText = yield this.openai
                                .generateReply({
                                userMessage: text,
                                intent: 'existing_customer_purchase_confirmation',
                                cart: purchasableItems,
                                currency,
                                purchaseFlowData: session.pendingPurchaseFlow.collectedData,
                            })
                                .catch(() => `┬íHola de nuevo, ${existingCustomer.fullName}! Ya tengo tus datos. ┬┐Procedemos con la compra?`);
                        }
                        else {
                            session.pendingPurchaseFlow = {
                                step: 'awaiting_customer_data',
                                purchaseFromQuote: false,
                                items: purchasableItems,
                                currency,
                                collectedData: { phoneNumber: localPhone },
                            };
                            replyText = yield this.openai
                                .generateReply({
                                userMessage: text,
                                intent: 'purchase_intent',
                            })
                                .catch(() => '┬íClaro! Para procesar tu compra necesito tu nombre completo y tu n├║mero de c├®dula.');
                        }
                    }
                    yield redis_1.redis.set(`session:${phoneNumber}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
                }
            }
            else {
                replyText = yield this.openai
                    .generateReply({ userMessage: text, isFirstInteraction })
                    .catch(() => 'Hola, soy Gema ­ƒæï ┬┐En qu├® te puedo ayudar?');
            }
            // Guardar ├║ltimo mensaje del bot en la sesi├│n para contexto en pr├│ximas respuestas
            session.lastBotMessage = replyText;
            yield redis_1.redis.set(`session:${phoneNumber}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
            yield new Promise(resolve => setTimeout(resolve, REPLY_DELAY_MS));
            yield this.sendReply(phoneNumber, botPhoneNumberId, replyText);
            this.logService
                .logMessage({
                phoneNumber,
                botPhoneNumberId,
                direction: 'outbound',
                text: replyText,
                intent: null,
                countryPrefix,
            })
                .catch(err => {
                console.error('[WhatsApp Agent] Error saving outbound message log:', err);
                this.logService
                    .logError({ context: 'logMessage:outbound', error: err, phoneNumber })
                    .catch(e => console.error('[WhatsApp Agent] Failed to save error log:', e));
            });
        });
        /** Strip country calling code prefix from WhatsApp E.164 phone number */
        this.stripCallingCode = (phoneNumber) => {
            const prefixes = ['593', '57']; // longest first
            const matched = prefixes.find(p => phoneNumber.startsWith(p));
            return matched ? phoneNumber.slice(matched.length) : phoneNumber;
        };
        this.detectCountryFromPhone = (phoneNumber) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                // Detectar callingCode desde el n├║mero (formato E.164 sin +)
                const prefixes = ['593', '57']; // Ecuador primero (m├ís largo)
                const matchedPrefix = prefixes.find(p => phoneNumber.startsWith(p));
                // ÔöÇÔöÇ INICIO BLOQUE DE TESTING ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
                // TEST_FORCE_COUNTRY_ISO fuerza un pa├¡s concreto ignorando el prefijo
                // del n├║mero. Permite probar el bot de Ecuador desde Colombia.
                // ÔÜá´©Å Remover o dejar en '' en producci├│n.
                const forcedIso = (_a = env_1.ENV.TEST_FORCE_COUNTRY_ISO) === null || _a === void 0 ? void 0 : _a.toUpperCase();
                const effectivePrefix = forcedIso === 'EC' ? '593' : forcedIso === 'CO' ? '57' : matchedPrefix;
                // ÔöÇÔöÇ FIN BLOQUE DE TESTING ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
                if (!effectivePrefix) {
                    console.warn(`[WhatsApp Agent] Unknown country prefix for ${phoneNumber}`);
                    return null;
                }
                // Resolver shop por pa├¡s usando slug (misma convenci├│n que customer-balance)
                const shopSlug = effectivePrefix === '57' ? 'manuarte-barranquilla' : 'manuarte-quito';
                const shop = yield model_5.ShopModel.findOne({
                    where: { slug: shopSlug },
                    attributes: ['id', 'currency'],
                    include: [
                        {
                            model: model_4.StockModel,
                            as: 'stock',
                            attributes: ['id'],
                        },
                        {
                            model: model_6.CountryModel,
                            as: 'country',
                            attributes: ['isoCode'],
                        },
                    ],
                });
                if (!shop)
                    return null;
                const stock = shop.get('stock');
                const country = shop.get('country');
                const stockIds = stock ? [stock.id] : [];
                const currency = (_b = shop.get('currency')) !== null && _b !== void 0 ? _b : 'USD';
                const isoCode = (_c = country === null || country === void 0 ? void 0 : country.isoCode) !== null && _c !== void 0 ? _c : (effectivePrefix === '57' ? 'CO' : 'EC');
                console.log(`[WhatsApp Agent] Country detected: +${effectivePrefix}, currency: ${currency}, shop: ${shopSlug}, stocks: ${stockIds.join(', ')}`);
                return { currency, stockIds, shopId: shop.id, isoCode };
            }
            catch (error) {
                console.error('[WhatsApp Agent] Error detecting country:', error);
                this.logService
                    .logError({ context: 'detectCountryFromPhone', error, phoneNumber })
                    .catch(e => console.error('[WhatsApp Agent] Failed to save error log:', e));
                return null;
            }
        });
        /**
         * Returns an intent only for cases the backend can resolve deterministically
         * (show_more, affirmation, show_cart). Returns null when uncertain
         * so the AI can take over.
         */
        this.detectDeterministicIntent = (normalizedText) => {
            const showMorePhrases = [
                'ver mas',
                'mas opciones',
                'quiero ver mas',
                'muestrame mas',
                'muestra mas',
                'hay mas',
                'tienes mas',
                'tienen mas',
                'no tienen mas',
                'no tienes mas',
                'no hay mas',
                'mostrar mas',
                'ver otras',
                'ver otros',
                'otras opciones',
                'otras alternativas',
                'alguna otra',
                'alguna mas',
                'algun otro',
                'tienen otra',
                'tienen otro',
                'tienen alguna',
                'tienes otra',
                'tienes otro',
                'mas productos',
                'ver mas opciones',
                'quiero ver otras',
                'quiero mas',
                'ver siguiente',
                'ver siguientes',
                'nada mas',
                'no tienen nada mas',
                'no tienes nada mas',
            ];
            const showMoreExact = /^(mas|otros|otras|siguiente|siguientes)[,!.\s?]*$/i;
            // Si el mensaje dice "tienes m├ís X" o "m├ís opciones de X" con un sustantivo
            // tras el modificador, es una b├║squeda nueva. Ej: "tienes m├ís mechas"
            const showMoreWithProductRegex = /(?:tienes\s+mas|tienen\s+mas|hay\s+mas|mas\s+opciones\s+de|mas\s+tipos\s+de)\s+\w/i;
            if (!showMoreWithProductRegex.test(normalizedText) &&
                (showMorePhrases.some(p => normalizedText.includes(p)) ||
                    showMoreExact.test(normalizedText.trim())))
                return 'show_more';
            // Afirmaci├│n con cantidad expl├¡cita: "S├¡, dame 5", "si quiero 3", "ok ponme 2"
            const affirmationWithQtyRegex = /^(si|vale|ok|dale|claro|listo|perfecto|bueno|de acuerdo|va|venga|obvio)[,\s!.]+(?:(?:dame|quiero|ponme|pon|agrega|necesito|llevo|llevame|mandame|enviame)\s+)?\d+\b/i;
            if (affirmationWithQtyRegex.test(normalizedText.trim()))
                return 'affirmation';
            const isAffirmationOnly = /^(si|vale|ok|dale|claro|listo|perfecto|bueno|de acuerdo|va|venga|obvio)[,!.\s?]*$/i.test(normalizedText.trim());
            if (isAffirmationOnly)
                return 'affirmation';
            const showCartPhrases = [
                'que llevamos',
                'que llevo',
                'mi carrito',
                'ver carrito',
                'ver pedido',
                'mi pedido',
                'lo que llevo',
                'lo que llevamos',
                'lo que tengo',
                'resumen del pedido',
                'mostrame el pedido',
                'muestrame el pedido',
                'muestrame que llevamos',
                'muestrame que llevo',
                'que hay en el carrito',
                'que tengo en el carrito',
                'cuanto seria el total',
                'cuanto seria por todo',
                'cuanto es el total',
                'cuanto es por todo',
                'cuanto va el total',
                'cuanto va todo',
                'cuanto es todo',
                'cuanto seria todo',
                'cuanto suma todo',
                'cuanto me sale todo',
                'cuanto me saldria todo',
                'cuanto seria en total',
                'a cuanto sube todo',
                'a cuanto llega todo',
                'a cuanto llega el total',
            ];
            if (showCartPhrases.some(p => normalizedText.includes(p)))
                return 'show_cart';
            const requestQuotePhrases = [
                'cotizacion',
                'cotizaci├│n',
                'cotizar',
                'cotizame',
                'cotizalo',
                'cotizalos',
                'presupuesto',
                'proforma',
                'hazme una cotizacion',
                'genera la cotizacion',
                'arma la cotizacion',
                'quiero cotizar',
                'quiero la cotizacion',
                'me generas la cotizacion',
                'enviame la cotizacion',
            ];
            if (requestQuotePhrases.some(p => normalizedText.includes(p)))
                return 'request_quote';
            const purchaseIntentPhrases = [
                'quiero comprar',
                'quiero pagar',
                'como pago',
                'c├│mo pago',
                'como compro',
                'c├│mo compro',
                'finalizar pedido',
                'finalizar compra',
                'completar compra',
                'completar pedido',
                'quiero proceder',
                'proceder con el pago',
                'hacer el pago',
                'realizar el pago',
                'pagar mi pedido',
            ];
            if (purchaseIntentPhrases.some(p => normalizedText.includes(p)))
                return 'purchase_intent';
            return null;
        };
        this.detectIntent = (normalizedText) => {
            const objectionPhrases = [
                'muy caro',
                'esta caro',
                'es caro',
                'caro',
                'no me alcanza',
                'no tengo',
                'sin dinero',
                'sin plata',
                'no tengo plata',
                'no tengo dinero',
                'lo pienso',
                'lo voy a pensar',
                'voy a pensar',
                'pensarlo',
                'despues',
                'luego',
                'mas adelante',
                'otro dia',
                'ahorita no',
                'por ahora no',
                'no por ahora',
                'lo consulto',
                'te aviso',
                'no me interesa',
                'ya no',
                'dejalo',
                'dejame pensar',
            ];
            const hasObjection = objectionPhrases.some(phrase => normalizedText.includes(phrase));
            if (hasObjection)
                return 'objection';
            const showMorePhrases = [
                'ver mas',
                'mas opciones',
                'quiero ver mas',
                'muestrame mas',
                'muestra mas',
                'hay mas',
                'tienes mas',
                'mostrar mas',
                'ver otras',
                'ver otros',
                'otras opciones',
                'otras alternativas',
                'mas productos',
                'ver mas opciones',
                'quiero ver otras',
                'quiero mas',
                'ver siguiente',
                'ver siguientes',
            ];
            const showMoreExact = /^(mas|otros|otras|siguiente|siguientes)[,!.\s?]*$/i;
            if (showMorePhrases.some(p => normalizedText.includes(p)) ||
                showMoreExact.test(normalizedText.trim()))
                return 'show_more';
            const isAffirmationOnly = /^(si|vale|ok|dale|claro|listo|perfecto|bueno|de acuerdo|va|venga|obvio)[,!.\s?]*$/i.test(normalizedText.trim());
            if (isAffirmationOnly)
                return 'affirmation';
            const productKeywords = [
                'producto',
                'precio',
                'tienes',
                'tienen',
                'hay',
                'busco',
                'buscando',
                'buscar',
                'buscas',
                'quiero',
                'necesito',
                'cuesta',
                'vale',
                'disponible',
                'stock',
                'venden',
                'vende',
                'interesa',
                'vendes',
            ];
            const hasProductKeyword = productKeywords.some(kw => normalizedText.includes(kw));
            if (hasProductKeyword)
                return 'search_product';
            const words = normalizedText.split(' ');
            const knownProductTerms = new Set(Object.keys(utils_1.SYNONYMS));
            const hasKnownProductTerm = words.some(w => knownProductTerms.has(w) || knownProductTerms.has((0, utils_1.stemTerm)(w)));
            if (hasKnownProductTerm)
                return 'search_product';
            const pureGreetingOrAckWords = new Set([
                'hola',
                'ola',
                'hey',
                'buenos',
                'buenas',
                'buen',
                'dias',
                'tardes',
                'noches',
                'madrugada',
                'como',
                'estas',
                'esta',
                'tal',
                'bien',
                'todo',
                'gracias',
                'ok',
                'perfecto',
                'genial',
                'entendido',
                'listo',
                'claro',
                'dale',
                'excelente',
                'super',
                'vale',
                'si',
                'bueno',
                'venga',
            ]);
            const substantiveWords = words.filter(w => w.length > 2 && !pureGreetingOrAckWords.has(w));
            if (substantiveWords.length > 0)
                return 'search_product';
            return 'greeting';
        };
        this.detectSelectionByName = (normalizedText, productList) => {
            const stopWords = new Set([
                'el',
                'la',
                'los',
                'las',
                'un',
                'una',
                'de',
                'del',
                'al',
                'en',
                'con',
                'por',
                'para',
                'me',
                'que',
                'se',
                'mi',
                'tu',
                'su',
                'ese',
                'esa',
                'eso',
                'esta',
                'este',
                'y',
                'o',
                'a',
            ]);
            const msgWords = normalizedText
                .split(/\s+/)
                .filter(w => w.length > 2 && !stopWords.has(w));
            if (msgWords.length === 0)
                return null;
            let bestIndex = null;
            let bestScore = 0;
            let bestRatio = 0;
            productList.forEach((product, i) => {
                const productNorm = (0, utils_1.normalizeText)(product.name);
                const variantNorm = product.variants
                    .map(v => { var _a; return (0, utils_1.normalizeText)((_a = v.name) !== null && _a !== void 0 ? _a : ''); })
                    .join(' ');
                const combined = `${productNorm} ${variantNorm}`;
                const productWords = combined
                    .split(/\s+/)
                    .filter(w => w.length > 2 && !stopWords.has(w));
                const score = msgWords.filter(w => productWords.includes(w)).length;
                // Usar ratio matched/total para preferir el producto m├ís espec├¡fico cuando hay empate.
                // Ej: "karite" coincide con "KARITE" (1/6=0.167) y con "AVENA & KARITE" (1/7=0.143),
                // ganando el primero por tener menos palabras extra.
                const ratio = score > 0 && productWords.length > 0 ? score / productWords.length : 0;
                if (ratio > bestRatio || (ratio === bestRatio && score > bestScore)) {
                    bestRatio = ratio;
                    bestScore = score;
                    bestIndex = i + 1;
                }
            });
            return bestScore >= 1 ? bestIndex : null;
        };
        this.detectSelection = (normalizedText) => {
            var _a;
            // "2", "el 2", "la 2", "el n├║mero 2", "n├║mero 2"
            const numMatch = normalizedText.match(/^(?:(?:el|la)\s+)?(?:numero\s+)?(\d+)$/);
            if (numMatch)
                return parseInt(numMatch[1], 10);
            // "me interesa la 2", "quiero el 3", "dame la 2 por favor"
            const contextNumMatch = normalizedText.match(/(?:el|la)\s+(?:numero\s+)?(\d+)(?:\s|$)/);
            if (contextNumMatch)
                return parseInt(contextNumMatch[1], 10);
            // Ordinales en espa├▒ol
            const ordinals = {
                primero: 1,
                primera: 1,
                segundo: 2,
                segunda: 2,
                tercero: 3,
                tercera: 3,
                cuarto: 4,
                cuarta: 4,
                quinto: 5,
                quinta: 5,
            };
            const clean = normalizedText.replace(/^(el|la)\s+/, '').trim();
            return (_a = ordinals[clean]) !== null && _a !== void 0 ? _a : null;
        };
        this.buildSelectionReply = (product, currency) => {
            if (product.variants.length === 1) {
                const v = product.variants[0];
                const priceText = (0, utils_1.formatPrice)(v.price, currency);
                const detail = v.name ? `${v.name} ÔÇô ${priceText}` : priceText;
                return (`Perfecto ­ƒæî\n\n*${product.name}*\n${detail} ┬À ${v.totalQty} disponibles` +
                    '\n\n┬┐Te ayudo con la cotizaci├│n o tienes alguna duda?');
            }
            const variantLines = product.variants.map(v => {
                const priceText = (0, utils_1.formatPrice)(v.price, currency);
                return `  - ${v.name} ÔÇô ${priceText} (${v.totalQty} disponibles)`;
            });
            return (`Perfecto ­ƒæî\n\n*${product.name}* lo tenemos en estas presentaciones:\n\n` +
                variantLines.join('\n') +
                '\n\n┬┐Con cu├íl te quedas?');
        };
        this.buildResumptionReply = (product) => {
            const variantLines = product.variants.map(v => `ÔÇó ${v.name}`).join('\n');
            return (`Hola ­ƒÿè retomamos donde lo dejamos.\n\nEst├íbamos viendo:\n\n*${product.name}*` +
                (product.description ? `\n_${product.description}_` : '') +
                (product.variants.length > 1 ? `\n${variantLines}` : '') +
                `\n\n┬┐Quieres continuar con ese o buscas algo diferente?`);
        };
        this.resolveVariant = (product, hint, userText) => {
            var _a;
            if (product.variants.length === 1)
                return product.variants[0];
            // 1) Hint-based match (existing logic)
            if (hint) {
                const normalizedHint = (0, utils_1.normalizeText)(hint);
                const match = (_a = product.variants.find(v => (0, utils_1.normalizeText)(v.name).includes(normalizedHint))) !== null && _a !== void 0 ? _a : product.variants.find(v => normalizedHint.includes((0, utils_1.normalizeText)(v.name)));
                if (match)
                    return match;
            }
            // 2) User text keyword match: score each variant by how many of its
            //    distinctive words appear in the message
            if (userText) {
                const normalized = (0, utils_1.normalizeText)(userText);
                let bestVariant;
                let bestScore = 0;
                for (const v of product.variants) {
                    const vWords = (0, utils_1.normalizeText)(v.name)
                        .split(/\s+/)
                        .filter(w => w.length > 1);
                    const score = vWords.filter(w => normalized.includes(w)).length;
                    if (score > bestScore) {
                        bestScore = score;
                        bestVariant = v;
                    }
                }
                if (bestVariant && bestScore > 0)
                    return bestVariant;
            }
            // 3) Fallback: pick variant with highest stock (most popular)
            return product.variants.reduce((best, v) => v.totalQty > best.totalQty ? v : best);
        };
        /**
         * Convierte el nombre de una variante a gramos cuando es posible.
         * Ej: "100g" ÔåÆ 100, "Medio Kilo" ÔåÆ 500, "KILO" ÔåÆ 1000, "(APROX. 20 unidades)" ÔåÆ null
         */
        this.parseVariantWeightGrams = (variantName) => {
            const normalized = variantName.toLowerCase().trim();
            // "Medio Kilo" ÔåÆ 500g
            if (/\bmedio\s*kilo\b/.test(normalized))
                return 500;
            // "1 kilo", "2 kilos", "1kg" ÔåÆ gramos
            const kiloMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:kilo[s]?|kg)/);
            if (kiloMatch)
                return parseFloat(kiloMatch[1].replace(',', '.')) * 1000;
            // "kilo" o "kilos" sin n├║mero ÔåÆ 1000g
            if (/^\s*kilo[s]?\s*$/.test(normalized))
                return 1000;
            // "100g", "250gr", "500 gramos" ÔåÆ gramos directos
            const gramMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:gr(?:amo[s]?)?|g\b)/);
            if (gramMatch)
                return parseFloat(gramMatch[1].replace(',', '.'));
            return null;
        };
        /**
         * Detecta si el texto del cliente especifica una cantidad por peso.
         * Devuelve el peso en gramos, o null si no hay unidad de peso reconocible.
         */
        this.detectRequestedWeightGrams = (text) => {
            const weightMatch = text.match(/\b(\d+(?:[.,]\d+)?)\s*(kilo[s]?|kg|gramo[s]?|gr|g)\b/i);
            if (!weightMatch)
                return null;
            const val = parseFloat(weightMatch[1].replace(',', '.'));
            const unit = weightMatch[2].toLowerCase();
            return unit.startsWith('k') ? val * 1000 : val;
        };
        /**
         * Dado un peso en gramos y las variantes de un producto, devuelve la variante
         * m├ís adecuada y la cantidad de unidades necesarias.
         *
         * L├│gica:
         * 1. Preferir variantes donde `requestedGrams` sea m├║ltiplo exacto de la variante.
         *    (ej: 4000g ÔåÆ KILO 1000g = exacto Ô£ô, CAJA 10 KILOS 10000g = no exacto Ô£ù)
         * 2. Entre candidatos exactos (o todos si no hay exactos), preferir la que da
         *    MENOS unidades (m├ís eficiente para el cliente).
         *    (ej: 10 kilos ÔåÆ KILO 10u vs CAJA 10 KILOS 1u ÔåÆ CAJA gana)
         */
        this.resolveVariantByWeight = (variants, requestedGrams) => {
            const weighted = variants
                .map(v => ({ variant: v, grams: this.parseVariantWeightGrams(v.name) }))
                .filter((vw) => vw.grams !== null && vw.grams > 0);
            if (weighted.length === 0)
                return null;
            const exactMatches = weighted.filter(vw => requestedGrams % vw.grams === 0);
            const candidates = exactMatches.length > 0 ? exactMatches : weighted;
            // Menor cantidad de unidades = presentaci├│n m├ís pr├íctica para la cantidad pedida
            const best = candidates.reduce((a, b) => {
                const unitsA = Math.ceil(requestedGrams / a.grams);
                const unitsB = Math.ceil(requestedGrams / b.grams);
                return unitsB < unitsA ? b : a;
            });
            return {
                variant: best.variant,
                units: Math.ceil(requestedGrams / best.grams),
            };
        };
        this.addToCart = (session, product, quantity, currency, variantOverride) => {
            var _a;
            if (!session.cart)
                session.cart = [];
            const variant = variantOverride !== null && variantOverride !== void 0 ? variantOverride : (product.variants.length === 1 ? product.variants[0] : undefined);
            // No agregar al carrito si el producto tiene m├║ltiples variantes y ninguna est├í resuelta
            if (!variant && product.variants.length > 1) {
                console.log(`[WhatsApp Agent] Cart add skipped for ${product.name}: ${product.variants.length} variants and none resolved.`);
                return;
            }
            const existing = session.cart.find(i => variant
                ? i.productVariantId === variant.variantId
                : i.productId === product.productId);
            if (existing) {
                existing.quantity = quantity;
                if (variant) {
                    existing.variantName = variant.name;
                    existing.unitPrice = variant.price;
                    existing.productVariantId = variant.variantId;
                    existing.stockItemId = variant.stockItemId;
                }
            }
            else {
                session.cart.push({
                    productId: product.productId,
                    productVariantId: variant === null || variant === void 0 ? void 0 : variant.variantId,
                    stockItemId: variant === null || variant === void 0 ? void 0 : variant.stockItemId,
                    productName: product.name,
                    variantName: variant === null || variant === void 0 ? void 0 : variant.name,
                    quantity,
                    unitPrice: (_a = variant === null || variant === void 0 ? void 0 : variant.price) !== null && _a !== void 0 ? _a : null,
                    currency,
                });
            }
            console.log(`[WhatsApp Agent] Cart updated: ${product.name}${variant ? ` ÔÇô ${variant.name}` : ''} x${quantity}. Cart size: ${session.cart.length}`);
        };
        /**
         * Verifica el stock actual de los ├¡tems del carrito y los separa en
         * "comprables" (stock suficiente) y "bloqueados" (stock insuficiente).
         * Los ├¡tems sin stockItemId se incluyen como comprables por defecto.
         */
        this.filterCartItemsByStock = (cartItems, stockIds) => __awaiter(this, void 0, void 0, function* () {
            const purchasableItems = [];
            const blockedItems = [];
            for (const item of cartItems) {
                if (!item.stockItemId) {
                    purchasableItems.push(item);
                    continue;
                }
                try {
                    const stockItem = yield model_3.StockItemModel.findOne({
                        where: Object.assign({ id: item.stockItemId, active: true }, (stockIds.length > 0 ? { stockId: { [sequelize_1.Op.in]: stockIds } } : {})),
                        attributes: ['quantity'],
                    });
                    if (!stockItem || Number(stockItem.get('quantity')) < item.quantity) {
                        blockedItems.push(item);
                    }
                    else {
                        purchasableItems.push(item);
                    }
                }
                catch (_a) {
                    // En caso de error al consultar stock, incluir el ├¡tem
                    purchasableItems.push(item);
                }
            }
            return { purchasableItems, blockedItems };
        });
        /** Devuelve el stock disponible actual de un stockItem (0 si no existe). */
        this.getAvailableStock = (stockItemId, stockIds) => __awaiter(this, void 0, void 0, function* () {
            try {
                const si = yield model_3.StockItemModel.findOne({
                    where: Object.assign({ id: stockItemId, active: true }, (stockIds.length > 0 ? { stockId: { [sequelize_1.Op.in]: stockIds } } : {})),
                    attributes: ['quantity'],
                });
                return si ? Number(si.get('quantity')) : 0;
            }
            catch (_a) {
                return 0;
            }
        });
        /**
         * Procesa una lista de productos y los agrega al carrito de la sesi├│n.
         * Usado en request_quote y en los handlers de awaiting_confirmation.
         * @returns objecto con n├║mero de productos agregados, lista de productos sin stock
         *          y detalles de sin-stock con alternativas disponibles
         */
        this.processProductListItems = (items_1, session_1, currency_1, countryInfo_1, ...args_1) => __awaiter(this, [items_1, session_1, currency_1, countryInfo_1, ...args_1], void 0, function* (items, session, currency, countryInfo, mode = 'purchase') {
            var _a;
            let added = 0;
            const outOfStock = [];
            const outOfStockDetails = [];
            const pushOutOfStock = (hint, allVariants, chosenVariantId, chosenStock = 0) => {
                outOfStock.push(hint);
                const alternatives = allVariants
                    .filter(v => v.variantId !== chosenVariantId && v.totalQty > 0)
                    .map(v => ({ name: v.name, stock: v.totalQty }));
                outOfStockDetails.push({
                    name: hint,
                    currentStock: chosenStock,
                    alternatives,
                });
            };
            for (const item of items) {
                try {
                    const result = yield this.buildProductReply((0, utils_1.normalizeText)(item.productHint), (_a = countryInfo !== null && countryInfo !== void 0 ? countryInfo : session.lastCountryInfo) !== null && _a !== void 0 ? _a : null, item.productHint);
                    if (!result.productFound || result.products.length === 0) {
                        console.log(`[WhatsApp Agent] Product list item not found: "${item.productHint}"`);
                        continue;
                    }
                    const product = result.products[0];
                    const qty = Math.max(1, item.quantity || 1);
                    const weightText = item.unit ? `${qty} ${item.unit}` : '';
                    const requestedGrams = weightText
                        ? this.detectRequestedWeightGrams(weightText)
                        : null;
                    if (requestedGrams !== null) {
                        const resolved = this.resolveVariantByWeight(product.variants, requestedGrams);
                        if (resolved) {
                            const stock = resolved.variant.totalQty;
                            const realName = [product.name, resolved.variant.name]
                                .filter(Boolean)
                                .join(' ')
                                .trim();
                            if (mode === 'purchase' && stock === 0) {
                                pushOutOfStock(realName, product.variants, resolved.variant.variantId, stock);
                                continue;
                            }
                            const cartQty = mode === 'quote'
                                ? resolved.units
                                : Math.min(resolved.units, stock);
                            this.addToCart(session, product, cartQty, currency, resolved.variant);
                            added++;
                            if (stock < resolved.units) {
                                pushOutOfStock(realName, product.variants, resolved.variant.variantId, stock);
                            }
                        }
                    }
                    else if (item.variantHint) {
                        const resolved = this.resolveVariant(product, item.variantHint, (0, utils_1.normalizeText)(item.productHint));
                        if (resolved) {
                            const stock = resolved.totalQty;
                            const realName = [product.name, resolved.name]
                                .filter(Boolean)
                                .join(' ')
                                .trim();
                            if (mode === 'purchase' && stock === 0) {
                                pushOutOfStock(realName, product.variants, resolved.variantId, stock);
                                continue;
                            }
                            const cartQty = mode === 'quote' ? qty : Math.min(qty, stock);
                            this.addToCart(session, product, cartQty, currency, resolved);
                            added++;
                            if (stock < qty) {
                                pushOutOfStock(realName, product.variants, resolved.variantId, stock);
                            }
                        }
                        else if (product.variants.length === 1) {
                            const stock = product.variants[0].totalQty;
                            const realName = [product.name, product.variants[0].name]
                                .filter(Boolean)
                                .join(' ')
                                .trim();
                            if (mode === 'purchase' && stock === 0) {
                                pushOutOfStock(realName, product.variants, product.variants[0].variantId, stock);
                                continue;
                            }
                            const cartQty = mode === 'quote' ? qty : Math.min(qty, stock);
                            this.addToCart(session, product, cartQty, currency, product.variants[0]);
                            added++;
                            if (stock < qty) {
                                pushOutOfStock(realName, product.variants, product.variants[0].variantId, stock);
                            }
                        }
                    }
                    else if (product.variants.length === 1) {
                        const stock = product.variants[0].totalQty;
                        const realName = [product.name, product.variants[0].name]
                            .filter(Boolean)
                            .join(' ')
                            .trim();
                        if (mode === 'purchase' && stock === 0) {
                            pushOutOfStock(realName, product.variants, product.variants[0].variantId, stock);
                            continue;
                        }
                        const cartQty = mode === 'quote' ? qty : Math.min(qty, stock);
                        this.addToCart(session, product, cartQty, currency, product.variants[0]);
                        added++;
                        if (stock < qty) {
                            pushOutOfStock(realName, product.variants, product.variants[0].variantId, stock);
                        }
                    }
                }
                catch (err) {
                    console.error(`[WhatsApp Agent] Error processing product list item: "${item.productHint}"`, err);
                }
            }
            return { added, outOfStock, outOfStockDetails };
        });
        /**
         * Maneja los pasos comunes de recopilaci├│n de datos del cliente
         * (awaiting_customer_data ÔåÆ awaiting_address ÔåÆ awaiting_city_selection ÔåÆ awaiting_confirmation).
         * Compartido entre handleQuoteFlowStep y handlePurchaseFlowStep.
         */
        this.handleCommonCollectionSteps = (flow, text, normalizedText, cart, currency, confirmationIntent, confirmationContextKey) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const getConfirmCtx = () => confirmationContextKey === 'quoteFlowData'
                ? { quoteFlowData: flow.collectedData }
                : { purchaseFlowData: flow.collectedData };
            if (flow.step === 'awaiting_customer_data') {
                const extracted = yield this.openai.extractCustomerData(text, 'customer_data');
                const fullName = (_a = extracted.fullName) !== null && _a !== void 0 ? _a : (_b = flow.collectedData) === null || _b === void 0 ? void 0 : _b.fullName;
                const dni = (_c = extracted.dni) !== null && _c !== void 0 ? _c : (_d = flow.collectedData) === null || _d === void 0 ? void 0 : _d.dni;
                if (!fullName || !dni) {
                    flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { fullName, dni });
                    const missing = !fullName && !dni
                        ? 'tu nombre completo y tu n├║mero de c├®dula'
                        : !fullName
                            ? 'tu nombre completo'
                            : 'tu n├║mero de c├®dula';
                    return yield this.openai
                        .generateReply({
                        userMessage: text,
                        intent: 'awaiting_customer_data',
                    })
                        .catch(() => `Me falta ${missing}. ┬┐Me lo compartes?`);
                }
                flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { fullName, dni });
                flow.step = 'awaiting_address';
                return yield this.openai
                    .generateReply({ userMessage: text, intent: 'awaiting_address' })
                    .catch(() => 'Perfecto. Ahora necesito tu direcci├│n de entrega y la ciudad, por favor.');
            }
            if (flow.step === 'awaiting_address') {
                const extracted = yield this.openai.extractCustomerData(text, 'address');
                const location = (_e = extracted.location) !== null && _e !== void 0 ? _e : (_f = flow.collectedData) === null || _f === void 0 ? void 0 : _f.location;
                const cityText = extracted.city;
                if (!location) {
                    return yield this.openai
                        .generateReply({ userMessage: text, intent: 'awaiting_address' })
                        .catch(() => 'Necesito tu direcci├│n de entrega para continuar. ┬┐Me la compartes?');
                }
                flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { location });
                if (!cityText)
                    return '┬┐Y en qu├® ciudad est├ís?';
                const cityResult = yield this.cityService.search(cityText);
                const cityResults = (_g = cityResult === null || cityResult === void 0 ? void 0 : cityResult.cities) !== null && _g !== void 0 ? _g : [];
                if (cityResults.length === 0) {
                    return `No encontr├® la ciudad "${cityText}". ┬┐Puedes escribirla de nuevo?`;
                }
                if (cityResults.length === 1) {
                    const city = cityResults[0].dataValues;
                    flow.collectedData.cityId = city.id;
                    flow.collectedData.cityName = `${city.name}, ${city.regionName}`;
                    flow.step = 'awaiting_confirmation';
                    return yield this.openai
                        .generateReply(Object.assign({ userMessage: text, intent: confirmationIntent, cart,
                        currency }, getConfirmCtx()))
                        .catch(() => '┬┐Confirmo con estos datos?');
                }
                flow.cityCandidates = cityResults.slice(0, 5).map(c => {
                    const d = c.dataValues;
                    return { id: d.id, name: d.name, regionName: d.regionName };
                });
                flow.step = 'awaiting_city_selection';
                return yield this.openai
                    .generateReply({
                    userMessage: text,
                    intent: 'awaiting_city_selection',
                    cityCandidates: flow.cityCandidates.map((c, i) => ({
                        index: i + 1,
                        name: c.name,
                        region: c.regionName,
                    })),
                })
                    .catch(() => {
                    const list = flow
                        .cityCandidates.map((c, i) => `${i + 1}. ${c.name}, ${c.regionName}`)
                        .join('\n');
                    return `Encontr├® varias opciones:\n${list}\n┬┐Cu├íl es la tuya?`;
                });
            }
            if (flow.step === 'awaiting_city_selection') {
                const candidates = (_h = flow.cityCandidates) !== null && _h !== void 0 ? _h : [];
                const selectionMatch = normalizedText.match(/^(\d+)$/);
                const selectedIdx = selectionMatch
                    ? parseInt(selectionMatch[1], 10) - 1
                    : -1;
                let selected;
                if (selectedIdx >= 0 && selectedIdx < candidates.length) {
                    selected = candidates[selectedIdx];
                }
                else {
                    selected = candidates.find(c => (0, utils_1.normalizeText)(c.name).includes(normalizedText) ||
                        normalizedText.includes((0, utils_1.normalizeText)(c.name)));
                }
                if (selected) {
                    flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { cityId: selected.id, cityName: `${selected.name}, ${selected.regionName}` });
                    flow.cityCandidates = undefined;
                    flow.step = 'awaiting_confirmation';
                    return yield this.openai
                        .generateReply(Object.assign({ userMessage: text, intent: confirmationIntent, cart,
                        currency }, getConfirmCtx()))
                        .catch(() => '┬┐Confirmo con estos datos?');
                }
                const list = candidates
                    .map((c, i) => `${i + 1}. ${c.name}, ${c.regionName}`)
                    .join('\n');
                return `No entend├¡ tu selecci├│n. Elige el n├║mero:\n${list}`;
            }
            return null;
        });
        /**
         * Maneja cada paso del flujo de cotizaci├│n. Retorna el texto de respuesta
         * si el paso fue procesado, o null si se debe continuar con el flujo normal.
         */
        this.handleQuoteFlowStep = (phoneNumber, botPhoneNumberId, text, normalizedText, session, countryInfo) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
            const flow = session.pendingQuoteFlow;
            const currency = (_c = (_b = (_a = session.lastCountryInfo) === null || _a === void 0 ? void 0 : _a.currency) !== null && _b !== void 0 ? _b : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _c !== void 0 ? _c : 'USD';
            // Permitir cancelar el flujo
            if (/\b(cancelar|cancelalo|dejalo|olvidalo)\b/i.test(normalizedText)) {
                session.pendingQuoteFlow = null;
                return 'Listo, cancel├® el proceso de cotizaci├│n. ┬┐Necesitas algo m├ís?';
            }
            // Manejar el paso de confirmaci├│n del carrito antes de iniciar el flujo de datos
            if (flow.step === 'awaiting_cart_confirmation') {
                const isConfirm = /^(si|s├¡|vale|ok|dale|claro|listo|perfecto|bueno|confirmo|de acuerdo|va|venga|correcto|todo bien|esta bien|procede|procedemos|sigamos|continua|generar|genera)\b/i.test(normalizedText.trim());
                if (!isConfirm) {
                    // No es confirmaci├│n ÔåÆ dejar que el flujo normal maneje edit_cart, search_product, etc.
                    return null;
                }
                // Confirmado ÔåÆ buscar cliente existente y transicionar
                const isoCode = (_f = (_e = (_d = session.lastCountryInfo) === null || _d === void 0 ? void 0 : _d.isoCode) !== null && _e !== void 0 ? _e : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.isoCode) !== null && _f !== void 0 ? _f : 'CO';
                const localPhone = this.stripCallingCode(phoneNumber);
                const existingCustomer = yield this.customerService.findByPhone(localPhone, isoCode);
                if (existingCustomer) {
                    flow.step = 'awaiting_confirmation';
                    flow.collectedData = {
                        fullName: existingCustomer.fullName,
                        dni: existingCustomer.dni,
                        phoneNumber: localPhone,
                        location: existingCustomer.location,
                        cityId: existingCustomer.cityId,
                        cityName: existingCustomer.cityName
                            ? `${existingCustomer.cityName}${existingCustomer.regionName ? `, ${existingCustomer.regionName}` : ''}`
                            : undefined,
                        customerId: existingCustomer.id,
                        personId: existingCustomer.personId,
                    };
                    return yield this.openai
                        .generateReply({
                        userMessage: text,
                        intent: 'existing_customer_confirmation',
                        cart: session.cart,
                        currency,
                        quoteFlowData: flow.collectedData,
                    })
                        .catch(() => `┬íHola de nuevo, ${existingCustomer.fullName}! Ya tengo tus datos registrados. ┬┐Procedemos con la cotizaci├│n?`);
                }
                else {
                    flow.step = 'awaiting_customer_data';
                    flow.collectedData = { phoneNumber: localPhone };
                    return yield this.openai
                        .generateReply({
                        userMessage: text,
                        intent: 'request_quote',
                    })
                        .catch(() => '┬íClaro! Para armarte la cotizaci├│n necesito tu nombre completo y tu n├║mero de c├®dula.');
                }
            }
            const commonReply = yield this.handleCommonCollectionSteps(flow, text, normalizedText, (_g = session.cart) !== null && _g !== void 0 ? _g : [], currency, 'awaiting_confirmation', 'quoteFlowData');
            if (commonReply !== null)
                return commonReply;
            if (flow.step === 'awaiting_confirmation') {
                // Detectar confirmaci├│n: comienza con palabra afirmativa Y no contiene intenci├│n de correcci├│n
                const startsAffirmative = /^(si|s├¡|vale|ok|dale|claro|listo|perfecto|bueno|confirmo|de acuerdo|va|venga|correcto|todo bien|esta bien|nada)\b/i.test(normalizedText.trim());
                const hasCorrection = /\b(cambiar|cambio|cambia|corregir|corrige|modificar|modifica|pero|mal|error|falta|no es|en vez de|en lugar de|la cedula|el nombre|la direccion|el telefono|el numero)\b/i.test(normalizedText);
                // Also detect when message contains a raw number that looks like a DNI correction
                const looksLikeDniCorrection = !startsAffirmative && /\b\d{6,12}\b/.test(normalizedText);
                const isConfirm = startsAffirmative && !hasCorrection && !looksLikeDniCorrection;
                if (!isConfirm) {
                    // Use AI to detect what the customer wants to correct
                    const correctionResult = yield this.openai.extractQuoteCorrection(text, (_h = flow.collectedData) !== null && _h !== void 0 ? _h : {});
                    let dataChanged = false;
                    // Apply corrections detected by AI
                    if (correctionResult.fullName) {
                        flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { fullName: correctionResult.fullName });
                        dataChanged = true;
                    }
                    if (correctionResult.dni) {
                        flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { dni: correctionResult.dni });
                        dataChanged = true;
                    }
                    if (correctionResult.phoneNumber) {
                        flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { phoneNumber: correctionResult.phoneNumber });
                        dataChanged = true;
                    }
                    if (correctionResult.location) {
                        flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { location: correctionResult.location });
                        dataChanged = true;
                    }
                    if (correctionResult.city) {
                        const cityText = correctionResult.city;
                        const cityResult = yield this.cityService.search(cityText);
                        const cityResults = (_j = cityResult === null || cityResult === void 0 ? void 0 : cityResult.cities) !== null && _j !== void 0 ? _j : [];
                        if (cityResults.length === 1) {
                            const city = cityResults[0].dataValues;
                            flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { cityId: city.id, cityName: `${city.name}, ${city.regionName}` });
                            dataChanged = true;
                        }
                        else if (cityResults.length > 1) {
                            flow.cityCandidates = cityResults.slice(0, 5).map(c => {
                                const d = c.dataValues;
                                return { id: d.id, name: d.name, regionName: d.regionName };
                            });
                            flow.step = 'awaiting_city_selection';
                            const list = flow.cityCandidates
                                .map((c, i) => `${i + 1}. ${c.name}, ${c.regionName}`)
                                .join('\n');
                            return `Encontr├® varias opciones para "${cityText}":\n${list}\n┬┐Cu├íl es?`;
                        }
                    }
                    if (dataChanged) {
                        return yield this.openai
                            .generateReply({
                            userMessage: text,
                            intent: 'awaiting_confirmation',
                            cart: session.cart,
                            currency,
                            quoteFlowData: flow.collectedData,
                        })
                            .catch(() => '┬┐Confirmo la cotizaci├│n con estos datos actualizados?');
                    }
                    // Check if the customer wants to ADD products to the cart
                    if (correctionResult.productsToAdd &&
                        correctionResult.productsToAdd.length > 0) {
                        const { added, outOfStock } = yield this.processProductListItems(correctionResult.productsToAdd, session, currency, countryInfo, 'quote');
                        if (added > 0 || outOfStock.length > 0) {
                            let reply = yield this.openai
                                .generateReply({
                                userMessage: text,
                                intent: 'awaiting_confirmation',
                                cart: session.cart,
                                currency,
                                quoteFlowData: flow.collectedData,
                            })
                                .catch(() => '┬┐Confirmo la cotizaci├│n con estos datos y productos actualizados?');
                            if (outOfStock.length > 0) {
                                const names = outOfStock.map(p => `- ${p}`).join('\n');
                                reply += `\n\nÔÜá´©Å Los siguientes productos no tienen stock suficiente actualmente:\n${names}`;
                            }
                            return reply;
                        }
                    }
                    // AI could not detect what to correct ÔÇö ask for clarification
                    return yield this.openai
                        .generateReply({
                        userMessage: text,
                        intent: 'awaiting_correction_unclear',
                        quoteFlowData: flow.collectedData,
                    })
                        .catch(() => '┬┐Qu├® dato necesitas corregir? Puedes decirme el nombre, c├®dula, direcci├│n o ciudad.');
                }
                // Generar la cotizaci├│n
                try {
                    const data = flow.collectedData;
                    const shopId = (_m = (_l = (_k = session.lastCountryInfo) === null || _k === void 0 ? void 0 : _k.shopId) !== null && _l !== void 0 ? _l : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.shopId) !== null && _m !== void 0 ? _m : '';
                    const items = this.mapCartToQuoteItems((_o = session.cart) !== null && _o !== void 0 ? _o : []);
                    if (items.length === 0) {
                        session.pendingQuoteFlow = null;
                        return 'No hay productos v├ílidos en tu pedido para generar la cotizaci├│n.';
                    }
                    // Si no tenemos customerId, buscar persona existente por DNI
                    // para evitar SequelizeUniqueConstraintError en person.dni
                    if (!data.customerId && data.dni) {
                        const existingPerson = yield model_10.PersonModel.findOne({
                            where: { dni: data.dni },
                            attributes: ['id'],
                        });
                        if (existingPerson) {
                            data.personId = existingPerson.id;
                            const existingCustomer = yield model_8.CustomerModel.findOne({
                                where: { personId: existingPerson.id },
                                attributes: ['id'],
                            });
                            if (existingCustomer) {
                                data.customerId = existingCustomer.id;
                            }
                        }
                    }
                    // Quitar c├│digo de pa├¡s del tel├®fono (ej: 573127600792 ÔåÆ 3127600792)
                    const rawPhone = (_p = data.phoneNumber) !== null && _p !== void 0 ? _p : phoneNumber;
                    const localPhone = rawPhone.replace(/^(57|593)/, '');
                    const result = yield this.quoteService.create({
                        quoteData: {
                            shopId,
                            items,
                            status: types_1.QuoteStatus.PENDING,
                            discountType: 'FIXED',
                            discount: 0,
                            shipping: 0,
                            requestedBy: env_1.ENV.WHATSAPP_BOT_USER_ID,
                            currency: currency,
                        },
                        customerData: {
                            fullName: (_q = data.fullName) !== null && _q !== void 0 ? _q : '',
                            dni: (_r = data.dni) !== null && _r !== void 0 ? _r : '',
                            email: '',
                            phoneNumber: localPhone,
                            location: (_s = data.location) !== null && _s !== void 0 ? _s : '',
                            cityId: String((_t = data.cityId) !== null && _t !== void 0 ? _t : ''),
                            customerId: data.customerId,
                            personId: data.personId,
                        },
                    });
                    // Limpiar flujo y carrito
                    session.pendingQuoteFlow = null;
                    session.cart = [];
                    session.selectedProduct = undefined;
                    // Guardar referencia de la cotizaci├│n para el flujo de compra
                    session.lastQuoteId = result.newQuote.id;
                    session.lastQuoteSerial = result.newQuote.serialNumber;
                    const serial = result.newQuote.serialNumber;
                    // Enviar PDF por WhatsApp antes de devolver el mensaje de confirmaci├│n
                    try {
                        const buffer = yield this.docsService.generateQuote(serial);
                        const filename = `CTZ-${serial}.pdf`;
                        const quoteResult = yield this.quoteService.getOne(serial);
                        if (quoteResult.status === 200) {
                            const quote = quoteResult.quote;
                            const mediaId = yield this.whatsAppService.uploadMedia(buffer, filename, botPhoneNumberId);
                            const { total } = (0, utils_2.calculateTotals)(quote);
                            const recipientPhone = `${quote.callingCode}${quote.phoneNumber}`;
                            const formattedTotal = (0, utils_2.formatCurrency)(total);
                            const caption = `­ƒôä Cotizaci├│n #${serial} por un total de ${formattedTotal}.\n\n`;
                            yield this.whatsAppService.sendDocument(recipientPhone, mediaId, botPhoneNumberId, filename, caption);
                        }
                    }
                    catch (err) {
                        console.error(`[WhatsApp Agent] Error sending quote PDF for ${serial}:`, err);
                    }
                    return 'Con gusto te ayudo a completar la compra ­ƒÿè';
                }
                catch (error) {
                    console.error('[WhatsApp Agent] Error creating quote:', error);
                    session.pendingQuoteFlow = null;
                    return 'Hubo un problema generando la cotizaci├│n. Por favor intenta de nuevo o contacta a nuestro equipo.';
                }
            }
            return null;
        });
        /**
         * Verifica si el momento actual est├í dentro del horario de atenci├│n.
         * LunesÔÇôViernes: 8:00ÔÇô18:00, S├íbado: 8:00ÔÇô14:00, Domingo: cerrado.
         * Usa la zona horaria America/Bogota (UTC-5).
         */
        this.isWithinOfficeHours = () => {
            const now = (0, date_fns_tz_1.toZonedTime)(new Date(), 'America/Bogota');
            const day = now.getDay(); // 0=Dom, 1=Lun, ..., 6=S├íb
            const hour = now.getHours();
            const minute = now.getMinutes();
            const timeInMinutes = hour * 60 + minute;
            if (day >= 1 && day <= 5) {
                // Lunes a Viernes: 8:00ÔÇô18:00
                return timeInMinutes >= 8 * 60 && timeInMinutes < 18 * 60;
            }
            if (day === 6) {
                // S├íbado: 8:00ÔÇô14:00
                return timeInMinutes >= 8 * 60 && timeInMinutes < 14 * 60;
            }
            return false; // Domingo cerrado
        };
        /**
         * Notifica al proveedor del pedido por WhatsApp.
         */
        this.handleIncomingImage = (phoneNumber, botPhoneNumberId, mediaId, mediaType) => {
            const prev = this.processingQueue.get(phoneNumber);
            let resolveCurrent;
            const current = new Promise(resolve => {
                resolveCurrent = resolve;
            });
            this.processingQueue.set(phoneNumber, current);
            const run = () => __awaiter(this, void 0, void 0, function* () {
                if (prev)
                    yield prev;
                try {
                    yield this.doHandleIncomingImage(phoneNumber, botPhoneNumberId, mediaId, mediaType);
                }
                finally {
                    resolveCurrent();
                    if (this.processingQueue.get(phoneNumber) === current) {
                        this.processingQueue.delete(phoneNumber);
                    }
                }
            });
            return run();
        };
        this.doHandleIncomingImage = (phoneNumber, botPhoneNumberId, mediaId, mediaType) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const raw = yield redis_1.redis.get(`session:${phoneNumber}`);
            const session = raw ? JSON.parse(raw) : {};
            const step = (_a = session.pendingPurchaseFlow) === null || _a === void 0 ? void 0 : _a.step;
            if (step !== 'awaiting_receipt' &&
                step !== 'awaiting_payment_confirmation') {
                // Media fuera del flujo de recibo: ignorar silenciosamente
                console.log(`[WhatsApp Agent] Received media from ${phoneNumber} outside receipt flow, ignoring.`);
                return;
            }
            const flow = session.pendingPurchaseFlow;
            const countryInfo = yield this.detectCountryFromPhone(phoneNumber);
            const isoCode = (_b = countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.isoCode) !== null && _b !== void 0 ? _b : 'CO';
            // Notificar al vendedor con el recibo adjunto
            yield this.notifyVendor(botPhoneNumberId, isoCode, flow, mediaId, mediaType).catch(err => console.error('[WhatsApp Agent] Error notifying vendor with receipt:', err));
            // Eliminar cotizaci├│n vinculada si aplica
            if (flow.purchaseFromQuote && flow.quoteId) {
                yield this.quoteService
                    .delete(flow.quoteId)
                    .catch(err => console.error('[WhatsApp Agent] Error deleting quote after purchase:', err));
                session.lastQuoteId = undefined;
                session.lastQuoteSerial = undefined;
            }
            // Limpiar flujo y carrito
            session.pendingPurchaseFlow = null;
            session.cart = [];
            yield redis_1.redis.set(`session:${phoneNumber}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
            const offHoursNote = !this.isWithinOfficeHours()
                ? '\n\nÔÅ░ Nuestro equipo est├í fuera de horario ahora mismo (LÔÇôV 8ÔÇô18h, S├íb 8ÔÇô14h), pero recibir├ín tu pedido y te contactar├ín a la brevedad.'
                : '';
            const reply = `Ô£à ┬íComprobante recibido! Nuestro equipo lo verificar├í y te confirmar├í el pedido en breve.` +
                offHoursNote +
                `\n\n┬íGracias por tu compra! ­ƒÖî`;
            yield this.sendReply(phoneNumber, botPhoneNumberId, reply);
        });
        /**
         * Notifica al proveedor del pedido por WhatsApp.
         */
        this.notifyVendor = (botPhoneNumberId, isoCode, flow, receiptMediaId, receiptMediaType) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g;
            const vendorPhone = isoCode === 'CO' ? env_1.ENV.SHOP_CO_PHONE_NUMBER : env_1.ENV.SHOP_EC_PHONE_NUMBER;
            if (!vendorPhone) {
                console.warn(`[WhatsApp Agent] No vendor phone configured for isoCode=${isoCode}`);
                return;
            }
            const d = (_a = flow.collectedData) !== null && _a !== void 0 ? _a : {};
            const itemLines = flow.items && flow.items.length > 0
                ? flow.items
                    .map(item => {
                    const name = item.variantName
                        ? `${item.productName} ÔÇô ${item.variantName}`
                        : item.productName;
                    return `  ÔÇó ${item.quantity}x ${name}`;
                })
                    .join('\n')
                : `ÔÇó Revisar Cotizaci├│n #${flow.quoteSerial}`;
            const totalLine = flow.total != null
                ? `\nTotal: ${(0, utils_1.formatPrice)(String(flow.total), (_b = flow.currency) !== null && _b !== void 0 ? _b : 'USD')}`
                : '';
            const refLine = flow.paymentRef ? `\nRef pago: ${flow.paymentRef}` : '';
            const quoteRefLine = flow.purchaseFromQuote && flow.quoteSerial
                ? `\nCotizaci├│n: #${flow.quoteSerial}`
                : '';
            const message = `­ƒøÆ *Nueva orden de compra*` +
                `\n\nCliente: ${(_c = d.fullName) !== null && _c !== void 0 ? _c : '-'}` +
                `\nC├®dula: ${(_d = d.dni) !== null && _d !== void 0 ? _d : '-'}` +
                `\nTel├®fono: ${(_e = d.phoneNumber) !== null && _e !== void 0 ? _e : '-'}` +
                `\nDirecci├│n: ${(_f = d.location) !== null && _f !== void 0 ? _f : '-'}` +
                `\nCiudad: ${(_g = d.cityName) !== null && _g !== void 0 ? _g : '-'}` +
                `\n\nProductos:\n${itemLines}` +
                totalLine +
                refLine +
                quoteRefLine +
                `\n\nÔ£à El cliente confirm├│ el pago. Por favor, verificar y procesar el pedido.`;
            if (receiptMediaId) {
                const sendMedia = receiptMediaType === 'document'
                    ? this.whatsAppService.sendDocument(vendorPhone, receiptMediaId, botPhoneNumberId, 'comprobante.pdf', message)
                    : this.whatsAppService.sendImage(vendorPhone, receiptMediaId, botPhoneNumberId, message);
                yield sendMedia.catch(err => console.error('[WhatsApp Agent] Error forwarding receipt to vendor:', err));
            }
            else {
                yield this.sendReply(vendorPhone, botPhoneNumberId, message);
            }
        });
        /**
         * Maneja los pasos del flujo de compra.
         * An├ílogo a handleQuoteFlowStep pero para completar una compra con link de pago.
         */
        /**
         * Construye el mensaje que pregunta al cliente qu├® quiere hacer
         * con los ├¡tems del carrito que no tienen stock suficiente.
         */
        this.buildOutOfStockResolutionMessage = (blockedItemsContext) => {
            const lines = [
                'Antes de continuar, necesito consultarte sobre algunos productos:',
            ];
            for (const blocked of blockedItemsContext) {
                const name = blocked.item.variantName
                    ? `${blocked.item.productName} ${blocked.item.variantName}`
                    : blocked.item.productName;
                lines.push(`\nÔÜá´©Å *${name}*: pediste ${blocked.item.quantity} pero solo hay ${blocked.availableStock} disponibles.`);
                const options = ['1. Llevar los que hay disponibles'];
                let optionIndex = 2;
                for (const alt of blocked.alternatives) {
                    options.push(`${optionIndex}. Cambiar a ${alt.name} (${alt.stock} disponibles)`);
                    optionIndex++;
                }
                options.push(`${optionIndex}. No incluirlo en el pedido`);
                lines.push(options.join('\n'));
            }
            lines.push('\n┬┐Qu├® prefieres hacer?');
            return lines.join('\n');
        };
        this.handlePurchaseFlowStep = (phoneNumber, botPhoneNumberId, text, normalizedText, session, countryInfo) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5;
            const flow = session.pendingPurchaseFlow;
            const isoCode = (_c = (_b = (_a = session.lastCountryInfo) === null || _a === void 0 ? void 0 : _a.isoCode) !== null && _b !== void 0 ? _b : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.isoCode) !== null && _c !== void 0 ? _c : 'CO';
            const currency = (_f = (_e = (_d = session.lastCountryInfo) === null || _d === void 0 ? void 0 : _d.currency) !== null && _e !== void 0 ? _e : countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _f !== void 0 ? _f : 'USD';
            // Permitir cancelar el flujo
            if (/\b(cancelar|cancelalo|no\s*quiero|dejalo|olvidalo)\b/i.test(normalizedText)) {
                session.pendingPurchaseFlow = null;
                return 'Listo, cancel├® el proceso de compra. ┬┐Necesitas algo m├ís?';
            }
            // ÔöÇÔöÇ Paso 0b: resoluci├│n de ├¡tems sin stock suficiente ÔöÇÔöÇ
            if (flow.step === 'awaiting_out_of_stock_resolution') {
                const blockedCtx = (_g = flow.blockedItemsContext) !== null && _g !== void 0 ? _g : [];
                // Detectar intenci├│n del cliente
                const wantsTakeAvailable = /\b(as[i├¡]|llevar\s+(los|las|el|la)?\s*(disponibles?|que\s+hay)|quiero?\s+(los|las)?\s*disponibles?|con\s+(los|las)?\s*disponibles?|tomar?\s+(los|las)?\s*disponibles?|los\s+que\s+hay|lo\s+que\s+hay)\b/i.test(normalizedText);
                // Detectar si el cliente pide una alternativa por nombre
                let chosenAlternative = null;
                for (const blocked of blockedCtx) {
                    for (const alt of blocked.alternatives) {
                        const altNorm = (0, utils_1.normalizeText)(alt.name);
                        if (normalizedText.includes(altNorm)) {
                            chosenAlternative = { blockedItem: blocked.item, variant: alt };
                            break;
                        }
                        // Intento por palabras clave (ej: "10 kilos")
                        const altWords = altNorm.split(/\s+/).filter(w => w.length > 2);
                        if (altWords.length > 0 &&
                            altWords.every(w => normalizedText.includes(w))) {
                            chosenAlternative = { blockedItem: blocked.item, variant: alt };
                            break;
                        }
                    }
                    if (chosenAlternative)
                        break;
                }
                // Construir lista de ├¡tems final (skip es el comportamiento por defecto)
                const updatedItems = [...((_h = flow.items) !== null && _h !== void 0 ? _h : [])];
                if (wantsTakeAvailable) {
                    // Agregar ├¡tems bloqueados con la cantidad disponible
                    for (const blocked of blockedCtx) {
                        if (blocked.availableStock > 0) {
                            updatedItems.push(Object.assign(Object.assign({}, blocked.item), { quantity: blocked.availableStock }));
                        }
                    }
                }
                else if (chosenAlternative) {
                    // Agregar la variante alternativa elegida (cantidad 1 por defecto)
                    const { blockedItem, variant } = chosenAlternative;
                    // Buscar stockItemId para la variante alternativa
                    const productEntry = (_j = session.lastProductList) === null || _j === void 0 ? void 0 : _j.find(p => p.productId === blockedItem.productId);
                    const altVariantEntry = productEntry === null || productEntry === void 0 ? void 0 : productEntry.variants.find(v => v.variantId === variant.variantId);
                    updatedItems.push(Object.assign(Object.assign({}, blockedItem), { productVariantId: variant.variantId, variantName: variant.name, stockItemId: (_k = altVariantEntry === null || altVariantEntry === void 0 ? void 0 : altVariantEntry.stockItemId) !== null && _k !== void 0 ? _k : null, quantity: 1, unitPrice: variant.unitPrice }));
                }
                // else wantsSkip (o por defecto): no agregar los bloqueados
                flow.items = updatedItems;
                flow.blockedItemsContext = undefined;
                // Continuar con el flujo de compra normal
                const localPhone = (_m = (_l = flow.collectedData) === null || _l === void 0 ? void 0 : _l.phoneNumber) !== null && _m !== void 0 ? _m : this.stripCallingCode(phoneNumber);
                const existingCustomer = yield this.customerService.findByPhone(localPhone, isoCode);
                if (existingCustomer) {
                    flow.collectedData = {
                        fullName: existingCustomer.fullName,
                        dni: existingCustomer.dni,
                        phoneNumber: localPhone,
                        location: existingCustomer.location,
                        cityId: existingCustomer.cityId,
                        cityName: existingCustomer.cityName
                            ? `${existingCustomer.cityName}${existingCustomer.regionName ? `, ${existingCustomer.regionName}` : ''}`
                            : undefined,
                        customerId: existingCustomer.id,
                        personId: existingCustomer.personId,
                    };
                    flow.step = 'awaiting_confirmation';
                    return yield this.openai
                        .generateReply({
                        userMessage: text,
                        intent: 'existing_customer_purchase_confirmation',
                        cart: updatedItems,
                        currency,
                        purchaseFlowData: flow.collectedData,
                    })
                        .catch(() => `┬íHola de nuevo, ${existingCustomer.fullName}! Ya tengo tus datos. ┬┐Procedemos con la compra?`);
                }
                else {
                    flow.collectedData = { phoneNumber: localPhone };
                    flow.step = 'awaiting_customer_data';
                    return yield this.openai
                        .generateReply({
                        userMessage: text,
                        intent: 'purchase_intent',
                    })
                        .catch(() => '┬íPerfecto! Para procesar tu compra necesito tu nombre completo y tu n├║mero de c├®dula.');
                }
            }
            // ÔöÇÔöÇ Paso 0: confirmar si procede desde la cotizaci├│n existente ÔöÇÔöÇ
            if (flow.step === 'awaiting_quote_confirmation') {
                const isConfirm = /^(si|s├¡|vale|ok|dale|claro|listo|perfecto|bueno|confirmo|de acuerdo|va|venga|correcto|todo bien|esta bien|nada|quiero|proceder|procede)\b/i.test(normalizedText.trim());
                if (isConfirm) {
                    // Cargar items de la cotizaci├│n
                    const quoteResult = yield this.quoteService.getOne(flow.quoteSerial);
                    if (quoteResult.status === 200 && quoteResult.quote) {
                        const quote = quoteResult.quote;
                        const items = ((_o = quote.quoteItems) !== null && _o !== void 0 ? _o : []).map((qi) => ({
                            productId: '',
                            productName: qi.name,
                            quantity: qi.quantity,
                            unitPrice: String(qi.price),
                            currency,
                        }));
                        const { total } = (0, utils_2.calculateTotals)(quote);
                        flow.items = items;
                        flow.total = total;
                        flow.currency = currency;
                        flow.purchaseFromQuote = true;
                        // Usar datos del cliente de la cotizaci├│n si los hay
                        flow.collectedData = (_p = flow.collectedData) !== null && _p !== void 0 ? _p : {
                            fullName: quote.fullName,
                            dni: quote.dni,
                            phoneNumber: quote.phoneNumber,
                            location: quote.location,
                            cityId: quote.cityId,
                            cityName: quote.cityName
                                ? `${quote.cityName}${quote.regionName ? `, ${quote.regionName}` : ''}`
                                : undefined,
                            customerId: String((_q = quote.customerId) !== null && _q !== void 0 ? _q : ''),
                        };
                    }
                    // Generar link y transitar a awaiting_payment_confirmation
                    const paymentRef = crypto_1.default.randomUUID();
                    const paymentLink = yield this.paymentLinkService.getLinkForCountry(isoCode, (_t = (_r = flow.total) !== null && _r !== void 0 ? _r : (_s = flow.items) === null || _s === void 0 ? void 0 : _s.reduce((sum, i) => sum + (i.unitPrice ? parseFloat(i.unitPrice) * i.quantity : 0), 0)) !== null && _t !== void 0 ? _t : 0, (_u = flow.currency) !== null && _u !== void 0 ? _u : currency, paymentRef);
                    const provider = this.paymentLinkService.getProviderName(isoCode);
                    flow.paymentRef = paymentRef;
                    flow.paymentLink = paymentLink;
                    flow.step = 'awaiting_receipt';
                    const itemLines = flow.items && flow.items.length > 0
                        ? flow.items
                            .map(i => {
                            const name = i.variantName
                                ? `${i.productName} ÔÇô ${i.variantName}`
                                : i.productName;
                            return `  ÔÇó ${i.quantity}x ${name}`;
                        })
                            .join('\n')
                        : '';
                    const totalStr = flow.total != null
                        ? (0, utils_1.formatPrice)(String(flow.total), (_v = flow.currency) !== null && _v !== void 0 ? _v : currency)
                        : '';
                    return (`┬íPerfecto! ­ƒÄë Aqu├¡ tienes tu link de pago con ${provider}:\n\n` +
                        `­ƒöù ${paymentLink}\n\n` +
                        (itemLines ? `Pedido:\n${itemLines}\n\n` : '') +
                        (totalStr ? `Total: ${totalStr}\n\n` : '') +
                        `Ref: ${paymentRef}\n\n` +
                        `Cuando realices el pago, env├¡anos el comprobante (imagen o PDF) para que nuestro equipo lo verifique. ­ƒô©`);
                }
                else {
                    // El cliente no quiere usar la cotizaci├│n ÔåÆ iniciar flujo con datos nuevos
                    const localPhone = this.stripCallingCode(phoneNumber);
                    flow.purchaseFromQuote = false;
                    flow.quoteId = undefined;
                    flow.quoteSerial = undefined;
                    // Verificar si ya existe el cliente
                    const existingCustomer = yield this.customerService.findByPhone(localPhone, isoCode);
                    if (existingCustomer) {
                        flow.collectedData = {
                            fullName: existingCustomer.fullName,
                            dni: existingCustomer.dni,
                            phoneNumber: localPhone,
                            location: existingCustomer.location,
                            cityId: existingCustomer.cityId,
                            cityName: existingCustomer.cityName
                                ? `${existingCustomer.cityName}${existingCustomer.regionName ? `, ${existingCustomer.regionName}` : ''}`
                                : undefined,
                            customerId: existingCustomer.id,
                            personId: existingCustomer.personId,
                        };
                        flow.step = 'awaiting_confirmation';
                        return yield this.openai
                            .generateReply({
                            userMessage: text,
                            intent: 'existing_customer_purchase_confirmation',
                            cart: (_w = flow.items) !== null && _w !== void 0 ? _w : session.cart,
                            currency,
                            purchaseFlowData: flow.collectedData,
                        })
                            .catch(() => `┬íHola de nuevo, ${existingCustomer.fullName}! Ya tengo tus datos. ┬┐Procedemos con la compra?`);
                    }
                    else {
                        flow.collectedData = { phoneNumber: localPhone };
                        flow.step = 'awaiting_customer_data';
                        return yield this.openai
                            .generateReply({
                            userMessage: text,
                            intent: 'purchase_intent',
                        })
                            .catch(() => '┬íClaro! Para procesar tu compra necesito tu nombre completo y tu n├║mero de c├®dula.');
                    }
                }
            }
            // ÔöÇÔöÇ Paso 1-3: recopilaci├│n de datos del cliente (reutiliza l├│gica com├║n) ÔöÇÔöÇ
            const commonReply = yield this.handleCommonCollectionSteps(flow, text, normalizedText, (_y = (_x = flow.items) !== null && _x !== void 0 ? _x : session.cart) !== null && _y !== void 0 ? _y : [], currency, 'awaiting_purchase_confirmation', 'purchaseFlowData');
            if (commonReply !== null)
                return commonReply;
            // ÔöÇÔöÇ Paso 4: confirmaci├│n de datos antes del pago ÔöÇÔöÇ
            if (flow.step === 'awaiting_confirmation') {
                const startsAffirmative = /^(si|s├¡|vale|ok|dale|claro|listo|perfecto|bueno|confirmo|de acuerdo|va|venga|correcto|todo bien|esta bien|nada)\b/i.test(normalizedText.trim());
                const hasCorrection = /\b(cambiar|cambio|cambia|corregir|corrige|modificar|modifica|pero|mal|error|falta|no es|en vez de|en lugar de|la cedula|el nombre|la direccion|el telefono|el numero)\b/i.test(normalizedText);
                const looksLikeDniCorrection = !startsAffirmative && /\b\d{6,12}\b/.test(normalizedText);
                const isConfirm = startsAffirmative && !hasCorrection && !looksLikeDniCorrection;
                if (!isConfirm) {
                    const correctionResult = yield this.openai.extractQuoteCorrection(text, (_z = flow.collectedData) !== null && _z !== void 0 ? _z : {});
                    let dataChanged = false;
                    if (correctionResult.fullName) {
                        flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { fullName: correctionResult.fullName });
                        dataChanged = true;
                    }
                    if (correctionResult.dni) {
                        flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { dni: correctionResult.dni });
                        dataChanged = true;
                    }
                    if (correctionResult.phoneNumber) {
                        flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { phoneNumber: correctionResult.phoneNumber });
                        dataChanged = true;
                    }
                    if (correctionResult.location) {
                        flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { location: correctionResult.location });
                        dataChanged = true;
                    }
                    if (correctionResult.city) {
                        const cityResult = yield this.cityService.search(correctionResult.city);
                        const cityResults = (_0 = cityResult === null || cityResult === void 0 ? void 0 : cityResult.cities) !== null && _0 !== void 0 ? _0 : [];
                        if (cityResults.length === 1) {
                            const city = cityResults[0].dataValues;
                            flow.collectedData = Object.assign(Object.assign({}, flow.collectedData), { cityId: city.id, cityName: `${city.name}, ${city.regionName}` });
                            dataChanged = true;
                        }
                        else if (cityResults.length > 1) {
                            flow.cityCandidates = cityResults.slice(0, 5).map(c => {
                                const d = c.dataValues;
                                return { id: d.id, name: d.name, regionName: d.regionName };
                            });
                            flow.step = 'awaiting_city_selection';
                            const list = flow.cityCandidates
                                .map((c, i) => `${i + 1}. ${c.name}, ${c.regionName}`)
                                .join('\n');
                            return `Encontr├® varias opciones para "${correctionResult.city}":\n${list}\n┬┐Cu├íl es?`;
                        }
                    }
                    if (dataChanged) {
                        return yield this.openai
                            .generateReply({
                            userMessage: text,
                            intent: 'awaiting_purchase_confirmation',
                            cart: (_1 = flow.items) !== null && _1 !== void 0 ? _1 : session.cart,
                            currency,
                            purchaseFlowData: flow.collectedData,
                        })
                            .catch(() => '┬┐Confirmo la compra con estos datos actualizados?');
                    }
                    // Check if the customer wants to ADD products to the cart
                    if (correctionResult.productsToAdd &&
                        correctionResult.productsToAdd.length > 0) {
                        const { added, outOfStock } = yield this.processProductListItems(correctionResult.productsToAdd, session, currency, countryInfo, 'purchase');
                        if (added > 0 || outOfStock.length > 0) {
                            let reply;
                            if (added > 0) {
                                flow.items = (_2 = session.cart) !== null && _2 !== void 0 ? _2 : [];
                                reply = yield this.openai
                                    .generateReply({
                                    userMessage: text,
                                    intent: 'awaiting_purchase_confirmation',
                                    cart: flow.items,
                                    currency,
                                    purchaseFlowData: flow.collectedData,
                                })
                                    .catch(() => '┬┐Confirmo la compra con estos datos y productos actualizados?');
                            }
                            else {
                                reply =
                                    'Los productos que mencionas no tienen stock disponible en este momento.';
                            }
                            if (outOfStock.length > 0) {
                                const names = outOfStock.map(p => `- ${p}`).join('\n');
                                reply += `\n\nÔÜá´©Å Los siguientes productos no tienen stock disponible y no fueron incluidos en el pedido:\n${names}`;
                            }
                            return reply;
                        }
                    }
                    return yield this.openai
                        .generateReply({
                        userMessage: text,
                        intent: 'awaiting_correction_unclear',
                        purchaseFlowData: flow.collectedData,
                    })
                        .catch(() => '┬┐Qu├® dato necesitas corregir? Puedes decirme el nombre, c├®dula, direcci├│n o ciudad.');
                }
                // Confirmado ÔÇö generar items y total si no est├ín a├║n
                if (!flow.items || flow.items.length === 0) {
                    flow.items = (_3 = session.cart) !== null && _3 !== void 0 ? _3 : [];
                }
                if (flow.total == null) {
                    flow.total = flow.items.reduce((sum, item) => {
                        return (sum +
                            (item.unitPrice ? parseFloat(item.unitPrice) * item.quantity : 0));
                    }, 0);
                    flow.currency = currency;
                }
                // Generar link de pago
                const paymentRef = crypto_1.default.randomUUID();
                const paymentLink = yield this.paymentLinkService.getLinkForCountry(isoCode, flow.total, (_4 = flow.currency) !== null && _4 !== void 0 ? _4 : currency, paymentRef);
                const provider = this.paymentLinkService.getProviderName(isoCode);
                flow.paymentRef = paymentRef;
                flow.paymentLink = paymentLink;
                flow.step = 'awaiting_receipt';
                const itemLines = flow.items.length > 0
                    ? flow.items
                        .map(i => {
                        const name = i.variantName
                            ? `${i.productName} ÔÇô ${i.variantName}`
                            : i.productName;
                        return `  ÔÇó ${i.quantity}x ${name}`;
                    })
                        .join('\n')
                    : '';
                const totalStr = (0, utils_1.formatPrice)(String(flow.total), (_5 = flow.currency) !== null && _5 !== void 0 ? _5 : currency);
                return (`┬íPerfecto! ­ƒÄë Aqu├¡ tienes tu link de pago con ${provider}:\n\n` +
                    `­ƒöù ${paymentLink}\n\n` +
                    (itemLines ? `Pedido:\n${itemLines}\n\n` : '') +
                    `Total: ${totalStr}\n\n` +
                    `Ref: ${paymentRef}\n\n` +
                    `Cuando realices el pago, env├¡anos el comprobante (imagen o PDF) para que nuestro equipo lo verifique. ­ƒô©`);
            }
            // ÔöÇÔöÇ Paso 5: confirmaci├│n de pago (compatibilidad sesiones anteriores) ÔöÇÔöÇ
            if (flow.step === 'awaiting_payment_confirmation') {
                // Transicionar directamente a awaiting_receipt
                flow.step = 'awaiting_receipt';
                return 'Por favor env├¡anos el comprobante de pago (imagen o PDF) para que nuestro equipo pueda verificarlo. ­ƒô©';
            }
            // ÔöÇÔöÇ Paso 6: esperando recibo ÔöÇÔöÇ
            if (flow.step === 'awaiting_receipt') {
                return 'Para continuar necesitamos el comprobante de pago. Por favor env├¡a una imagen o PDF del comprobante. ­ƒô©';
            }
            return null;
        });
        this.mapCartToQuoteItems = (cart) => {
            return cart
                .filter(item => item.productVariantId)
                .map(item => {
                var _a;
                const price = item.unitPrice ? parseFloat(item.unitPrice) : 0;
                const name = item.variantName
                    ? `${item.productName} ÔÇô ${item.variantName}`
                    : item.productName;
                return {
                    productVariantId: item.productVariantId,
                    stockItemId: (_a = item.stockItemId) !== null && _a !== void 0 ? _a : undefined,
                    quoteId: '',
                    name,
                    quantity: item.quantity,
                    price,
                    currency: item.currency,
                };
            });
        };
        this.buildProductReply = (normalizedText, countryInfo, aiSearchQuery) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const stopWords = [
                // intenci├│n
                'producto',
                'precio',
                'tienes',
                'tienen',
                'hay',
                'busco',
                'buscando',
                'buscar',
                'buscas',
                'quiero',
                'necesito',
                'cuesta',
                'vale',
                'disponible',
                'stock',
                'venden',
                'vende',
                'interesa',
                'vendes',
                // verbos comunes
                'estoy',
                'estas',
                'tiene',
                'tengo',
                // art├¡culos y preposiciones
                'el',
                'la',
                'los',
                'las',
                'un',
                'una',
                'unos',
                'unas',
                'de',
                'del',
                'al',
                'por',
                'para',
                'con',
                'sin',
                'en',
                'que',
                // conectores y filler words
                'favor',
                'tambien',
                'mas',
                'si',
                'no',
                'me',
                'puedo',
                'porfavor',
                'gracias',
                'hola',
                'buen',
                'buenos',
                'buenas',
                'dias',
                'tardes',
                'noches',
                'como',
                'esta',
                'ese',
                'esa',
                'este',
                'esto',
                'eso',
                'sus',
                'les',
                'nos',
            ];
            // If AI provided a clean search query, use it directly (skip stopword filtering)
            const baseText = aiSearchQuery
                ? (0, utils_1.normalizeText)(aiSearchQuery)
                : normalizedText;
            const searchTerms = aiSearchQuery
                ? baseText.split(' ').filter(w => w.length > 1 && !/^\d+$/.test(w))
                : normalizedText
                    .split(' ')
                    .filter(w => w.length > 2 && !stopWords.includes(w) && !/^\d+$/.test(w));
            const expandedTerms = [
                ...new Set(searchTerms.flatMap(t => { var _a; return [t, ...((_a = utils_1.SYNONYMS[(0, utils_1.stemTerm)(t)]) !== null && _a !== void 0 ? _a : [])]; })),
            ];
            if (searchTerms.length === 0) {
                return {
                    replyText: '┬┐Qu├® producto buscas? Dime el nombre y te ayudo. ­ƒÿè',
                    searchTerms: [],
                    productFound: false,
                    suggestionsShown: false,
                    products: [],
                    remainingProducts: [],
                };
            }
            try {
                const stockItemWhere = countryInfo && countryInfo.stockIds.length > 0
                    ? { stockId: { [sequelize_1.Op.in]: countryInfo.stockIds }, active: true }
                    : { active: true };
                const variantInclude = {
                    model: model_2.ProductVariantModel,
                    as: 'productVariants',
                    attributes: ['name', 'id'],
                    include: [
                        {
                            model: model_3.StockItemModel,
                            as: 'stockItems',
                            attributes: ['id', 'quantity', 'price'],
                            where: stockItemWhere,
                            required: false,
                        },
                    ],
                };
                // B├║squeda AND: todos los t├®rminos deben aparecer en el nombre.
                // Los t├®rminos en SYNONYM_REPLACEMENTS se reemplazan por su equivalente en BD
                // (ej: "esencia" ÔåÆ "fragancia") para evitar falsos positivos por substring.
                const effectiveTermsPerSearch = searchTerms.map(t => {
                    var _a;
                    const stem = (0, utils_1.stemTerm)(t);
                    return (_a = utils_1.SYNONYM_REPLACEMENTS[stem]) !== null && _a !== void 0 ? _a : [t];
                });
                let products = yield model_1.ProductModel.findAll({
                    attributes: ['id', 'name', 'description'],
                    where: {
                        [sequelize_1.Op.and]: effectiveTermsPerSearch.map(terms => ({
                            [sequelize_1.Op.or]: terms.map(term => database_1.sequelize.where(database_1.sequelize.fn('unaccent', database_1.sequelize.col('ProductModel.name')), { [sequelize_1.Op.iLike]: `%${(0, utils_1.stemTerm)(term)}%` })),
                        })),
                    },
                    include: [variantInclude],
                    limit: 20,
                });
                // Termsinos de sin├│nimos puros (no originales)
                const synonymOnlyTerms = expandedTerms.filter(t => !searchTerms.includes(t));
                // Expandir sin├│nimos como OR alternativo SOLO cuando la b├║squeda AND no encontr├│ nada.
                // Si el AND ya encontr├│ el producto espec├¡fico (ej: "cera de palma" ÔåÆ "Cera de Palma / de Vaso"),
                // no agregar sin├│nimos gen├®ricos (ej: "soya", "parafina") que contaminar├¡an los resultados.
                if (synonymOnlyTerms.length > 0 && products.length === 0) {
                    const synonymProducts = yield model_1.ProductModel.findAll({
                        attributes: ['id', 'name', 'description'],
                        where: {
                            [sequelize_1.Op.or]: synonymOnlyTerms.map(term => database_1.sequelize.where(database_1.sequelize.fn('unaccent', database_1.sequelize.col('ProductModel.name')), { [sequelize_1.Op.iLike]: `%${(0, utils_1.stemTerm)(term)}%` })),
                        },
                        include: [variantInclude],
                        limit: 20,
                    });
                    // Fusionar deduplicando por id
                    const existingIds = new Set(products.map(p => p.id));
                    for (const p of synonymProducts) {
                        if (!existingIds.has(p.id))
                            products.push(p);
                    }
                }
                // Fallback OR: si no encontr├│ nada con AND ni con sin├│nimos, buscar con cualquier t├®rmino original
                if (products.length === 0 && searchTerms.length > 1) {
                    console.log('[WhatsApp Agent] AND search returned 0 results, trying OR fallback.');
                    products = yield model_1.ProductModel.findAll({
                        attributes: ['id', 'name', 'description'],
                        where: {
                            [sequelize_1.Op.or]: expandedTerms.map(term => database_1.sequelize.where(database_1.sequelize.fn('unaccent', database_1.sequelize.col('ProductModel.name')), { [sequelize_1.Op.iLike]: `%${(0, utils_1.stemTerm)(term)}%` })),
                        },
                        include: [variantInclude],
                        limit: 20,
                    });
                }
                const currency = (_a = countryInfo === null || countryInfo === void 0 ? void 0 : countryInfo.currency) !== null && _a !== void 0 ? _a : 'USD';
                const scored = [];
                const outOfStockNames = [];
                for (const p of products) {
                    const variants = p.get('productVariants');
                    const nameLower = (0, utils_1.normalizeText)(p.name);
                    const description = (_b = p.get('description')) !== null && _b !== void 0 ? _b : '';
                    const availableVariants = (variants !== null && variants !== void 0 ? variants : [])
                        .map(v => {
                        var _a, _b, _c, _d;
                        const totalQty = v.stockItems.reduce((sum, si) => sum + Number(si.quantity), 0);
                        const price = (_b = (_a = v.stockItems[0]) === null || _a === void 0 ? void 0 : _a.price) !== null && _b !== void 0 ? _b : null;
                        const stockItemId = (_d = (_c = v.stockItems[0]) === null || _c === void 0 ? void 0 : _c.id) !== null && _d !== void 0 ? _d : null;
                        return {
                            variantId: v.id,
                            stockItemId,
                            name: v.name,
                            totalQty,
                            price,
                        };
                    })
                        .filter(v => v.totalQty > 0);
                    if (availableVariants.length === 0) {
                        outOfStockNames.push(p.name);
                        continue;
                    }
                    // Relevancia textual: cu├íntos t├®rminos coinciden y con qu├® precisi├│n
                    const nameWords = nameLower.split(/\s+/);
                    // Word-boundary match: term matches a complete word in the name
                    const wordMatchCount = searchTerms.filter(t => {
                        const stem = (0, utils_1.stemTerm)(t);
                        return nameWords.some(w => w === stem || w.startsWith(stem));
                    }).length;
                    // Substring-only match: appears in name but NOT as a whole word
                    // (e.g. "cera" inside "encerada")
                    const substringMatchCount = searchTerms.filter(t => {
                        const stem = (0, utils_1.stemTerm)(t);
                        const inName = nameLower.includes(stem);
                        const isWord = nameWords.some(w => w === stem || w.startsWith(stem));
                        return inName && !isWord;
                    }).length;
                    const descMatchCount = searchTerms.filter(t => (0, utils_1.normalizeText)(description).includes((0, utils_1.stemTerm)(t))).length;
                    const exactMatch = nameLower === searchTerms.join(' ') ? 1000 : 0;
                    // Product-type bonus: search term is the first word of the product name
                    const productTypeBonus = searchTerms.some(t => {
                        var _a;
                        const stem = (0, utils_1.stemTerm)(t);
                        return nameWords[0] === stem || ((_a = nameWords[0]) === null || _a === void 0 ? void 0 : _a.startsWith(stem));
                    })
                        ? 50
                        : 0;
                    const startsWithMatch = searchTerms.some(t => nameLower.startsWith((0, utils_1.stemTerm)(t)))
                        ? 10
                        : 0;
                    const totalStock = availableVariants.reduce((sum, v) => sum + v.totalQty, 0);
                    // Relevance score (primary): determines product ordering tier
                    const relevanceScore = exactMatch +
                        productTypeBonus +
                        wordMatchCount * 30 +
                        substringMatchCount * 3 +
                        descMatchCount * 3 +
                        startsWithMatch +
                        availableVariants.length;
                    // Final score: relevance dominates, stock breaks ties within same tier
                    const score = relevanceScore * 1000 + totalStock;
                    scored.push({
                        score,
                        productId: String(p.id),
                        name: p.name,
                        description: description || undefined,
                        variants: availableVariants,
                    });
                }
                scored.sort((a, b) => b.score - a.score);
                if (scored.length === 0) {
                    const outOfStockProductName = outOfStockNames.length > 0 ? outOfStockNames[0] : undefined;
                    const suggestions = yield this.buildSuggestions(searchTerms, stockItemWhere);
                    return {
                        replyText: suggestions.replyText,
                        searchTerms,
                        productFound: false,
                        suggestionsShown: suggestions.products.length > 0,
                        products: suggestions.products,
                        remainingProducts: suggestions.remainingProducts,
                        outOfStockProductName,
                    };
                }
                // Group products with same base name that differ only by color suffix.
                // e.g. "Pigmento para cera arena MORADO", "...AMARILLO" ÔåÆ one grouped entry.
                const KNOWN_COLORS = new Set([
                    'morado',
                    'amarillo',
                    'rosado',
                    'naranja',
                    'verde',
                    'magenta',
                    'rojo',
                    'azul',
                    'negro',
                    'blanco',
                    'violeta',
                    'lila',
                    'turquesa',
                    'dorado',
                    'plateado',
                    'celeste',
                    'beige',
                    'coral',
                    'marfil',
                    'chocolate',
                    'cafe',
                    'fucsia',
                    'gris',
                    'rosa',
                    'aguamarina',
                ]);
                const getBaseName = (name) => {
                    const words = (0, utils_1.normalizeText)(name).split(/\s+/);
                    if (words.length < 2)
                        return null;
                    const lastWord = words[words.length - 1];
                    if (KNOWN_COLORS.has(lastWord))
                        return words.slice(0, -1).join(' ');
                    return null;
                };
                // Build groups by base name
                const groupMap = new Map();
                const ungrouped = [];
                for (const s of scored) {
                    const baseName = getBaseName(s.name);
                    if (baseName) {
                        const group = (_c = groupMap.get(baseName)) !== null && _c !== void 0 ? _c : [];
                        group.push(s);
                        groupMap.set(baseName, group);
                    }
                    else {
                        ungrouped.push(s);
                    }
                }
                // Collapse groups of 3+ into a single representative entry
                const collapsed = [...ungrouped];
                const groupedRemaining = [];
                for (const [, group] of groupMap.entries()) {
                    if (group.length >= 3) {
                        // Take highest scored as representative
                        const [representative, ...rest] = group;
                        const colorNames = group.map(g => {
                            const words = g.name.split(/\s+/);
                            return words[words.length - 1];
                        });
                        const totalGroupStock = group.reduce((sum, g) => sum + g.variants.reduce((s, v) => s + v.totalQty, 0), 0);
                        collapsed.push(Object.assign(Object.assign({}, representative), { name: representative.name.split(/\s+/).slice(0, -1).join(' '), description: `Disponible en ${group.length} colores: ${colorNames.join(', ')} (${totalGroupStock} unidades en total)` }));
                        groupedRemaining.push(...rest);
                    }
                    else {
                        collapsed.push(...group);
                    }
                }
                // Re-sort collapsed list by score
                collapsed.sort((a, b) => b.score - a.score);
                const displayedScored = collapsed.slice(0, MAX_PRODUCT_RESULTS);
                const remainingScored = [
                    ...collapsed.slice(MAX_PRODUCT_RESULTS),
                    ...groupedRemaining,
                ];
                const lines = displayedScored.map((s, i) => {
                    if (s.variants.length === 1) {
                        const v = s.variants[0];
                        const priceText = (0, utils_1.formatPrice)(v.price, currency);
                        const label = v.name ? `${s.name} ${v.name}` : s.name;
                        return `${i + 1}. ${label} ÔÇô ${priceText}`;
                    }
                    // Multi-variant: show product name with variant sub-list
                    const variantLines = s.variants
                        .map(v => `   - ${v.name}: ${(0, utils_1.formatPrice)(v.price, currency)} (${v.totalQty} disponibles)`)
                        .join('\n');
                    return `${i + 1}. ${s.name}\n${variantLines}`;
                });
                const productList = displayedScored.map(s => ({
                    productId: s.productId,
                    name: s.name,
                    description: s.description,
                    variants: s.variants,
                }));
                const remainingProducts = remainingScored.map(s => ({
                    productId: s.productId,
                    name: s.name,
                    description: s.description,
                    variants: s.variants,
                }));
                const replyText = `Claro ­ƒÿè te muestro lo que tenemos:\n\n${lines.join('\n\n')}`;
                return {
                    replyText,
                    searchTerms,
                    productFound: true,
                    suggestionsShown: false,
                    products: productList,
                    remainingProducts,
                };
            }
            catch (error) {
                console.error('[WhatsApp Agent] Error searching products:', error);
                this.logService
                    .logError({
                    context: 'buildProductReply',
                    error,
                    rawText: normalizedText,
                })
                    .catch(e => console.error('[WhatsApp Agent] Failed to save error log:', e));
                return {
                    replyText: 'Algo sali├│ mal de mi lado ­ƒÿò ┬┐Puedes repetirme qu├® est├ís buscando?',
                    searchTerms: [],
                    productFound: false,
                    suggestionsShown: false,
                    products: [],
                    remainingProducts: [],
                };
            }
        });
        this.buildSuggestions = (searchTerms, stockItemWhere) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Buscar productos que coincidan con los t├®rminos (sin filtro de stock)
                // para obtener sus categor├¡as
                const matchingProducts = yield model_1.ProductModel.findAll({
                    attributes: ['id', 'productCategoryId'],
                    where: {
                        [sequelize_1.Op.or]: searchTerms.map(term => database_1.sequelize.where(database_1.sequelize.fn('unaccent', database_1.sequelize.col('ProductModel.name')), { [sequelize_1.Op.iLike]: `%${(0, utils_1.stemTerm)(term)}%` })),
                    },
                    limit: 10,
                });
                if (matchingProducts.length === 0) {
                    return {
                        replyText: 'Mmm ­ƒñö no lo encontr├® con ese nombre. ┬┐Puedes contarme un poco m├ís o qu├® tipo de insumo buscas?',
                        products: [],
                        remainingProducts: [],
                    };
                }
                const categoryIds = [
                    ...new Set(matchingProducts
                        .map(p => p.get('productCategoryId'))
                        .filter(Boolean)),
                ];
                // Buscar todos los productos en esas categor├¡as con stock disponible (sin l├¡mite)
                const suggestions = yield model_1.ProductModel.findAll({
                    attributes: ['id', 'name', 'description'],
                    where: {
                        productCategoryId: { [sequelize_1.Op.in]: categoryIds },
                    },
                    include: [
                        {
                            model: model_2.ProductVariantModel,
                            as: 'productVariants',
                            attributes: ['id', 'name'],
                            include: [
                                {
                                    model: model_3.StockItemModel,
                                    as: 'stockItems',
                                    attributes: ['id', 'quantity', 'price'],
                                    where: Object.assign(Object.assign({}, stockItemWhere), { quantity: { [sequelize_1.Op.gt]: 0 } }),
                                    required: true,
                                },
                            ],
                            required: true,
                        },
                    ],
                });
                if (suggestions.length === 0) {
                    return {
                        replyText: 'Ese producto no lo tenemos disponible ahora. ┬┐Puedes contarme m├ís sobre lo que necesitas? ­ƒÿè',
                        products: [],
                        remainingProducts: [],
                    };
                }
                // Mapear a ProductListEntry y ordenar por mayor disponibilidad
                const allProducts = suggestions
                    .map(p => {
                    const variants = p.get('productVariants');
                    const availableVariants = (variants !== null && variants !== void 0 ? variants : []).map(v => {
                        var _a, _b, _c, _d;
                        return ({
                            variantId: v.id,
                            stockItemId: (_b = (_a = v.stockItems[0]) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null,
                            name: v.name,
                            totalQty: v.stockItems.reduce((sum, si) => sum + Number(si.quantity), 0),
                            price: (_d = (_c = v.stockItems[0]) === null || _c === void 0 ? void 0 : _c.price) !== null && _d !== void 0 ? _d : null,
                        });
                    });
                    const totalQty = availableVariants.reduce((sum, v) => sum + v.totalQty, 0);
                    return {
                        productId: String(p.id),
                        name: p.name,
                        description: p.get('description') || undefined,
                        variants: availableVariants,
                        totalQty,
                    };
                })
                    .sort((a, b) => b.totalQty - a.totalQty);
                const flatProducts = [];
                for (const p of allProducts) {
                    if (p.variants.length === 1) {
                        flatProducts.push(p);
                    }
                    else {
                        for (const v of p.variants) {
                            flatProducts.push(Object.assign(Object.assign({}, p), { variants: [v], totalQty: v.totalQty }));
                        }
                    }
                }
                const productList = flatProducts
                    .slice(0, MAX_PRODUCT_RESULTS)
                    .map(
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                (_a) => {
                    var { totalQty: _ } = _a, p = __rest(_a, ["totalQty"]);
                    return p;
                });
                const remainingProducts = flatProducts
                    .slice(MAX_PRODUCT_RESULTS)
                    .map(
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                (_a) => {
                    var { totalQty: _ } = _a, p = __rest(_a, ["totalQty"]);
                    return p;
                });
                return { replyText: '', products: productList, remainingProducts };
            }
            catch (error) {
                console.error('[WhatsApp Agent] Error building suggestions:', error);
                this.logService
                    .logError({ context: 'buildSuggestions', error })
                    .catch(e => console.error('[WhatsApp Agent] Failed to save error log:', e));
                return {
                    replyText: 'No lo tenemos disponible en este momento. ┬┐Puedo ayudarte con otro insumo? ­ƒÿè',
                    products: [],
                    remainingProducts: [],
                };
            }
        });
        this.sendReply = (to, botPhoneNumberId, replyText) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d;
            if (!env_1.ENV.WHATSAPP_ACCESS_TOKEN) {
                console.error('[WhatsApp Agent] WHATSAPP_ACCESS_TOKEN not set.');
                this.logService
                    .logError({
                    context: 'sendReply',
                    error: new Error('WHATSAPP_ACCESS_TOKEN not set'),
                    phoneNumber: to,
                })
                    .catch(e => console.error('[WhatsApp Agent] Failed to save error log:', e));
                return;
            }
            try {
                yield axios_1.default.post(`https://graph.facebook.com/v21.0/${botPhoneNumberId}/messages`, {
                    messaging_product: 'whatsapp',
                    to,
                    type: 'text',
                    text: {
                        body: replyText,
                    },
                }, {
                    headers: {
                        Authorization: `Bearer ${env_1.ENV.WHATSAPP_ACCESS_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    timeout: WHATSAPP_API_TIMEOUT_MS,
                });
                console.log(`[WhatsApp Agent] Reply sent to ${to}`);
            }
            catch (error) {
                if (error instanceof axios_1.AxiosError) {
                    if (error.code === 'ECONNABORTED') {
                        console.error(`[WhatsApp Agent] Timeout sending reply to ${to}`);
                        this.logService
                            .logError({ context: 'sendReply:timeout', error, phoneNumber: to })
                            .catch(e => console.error('[WhatsApp Agent] Failed to save error log:', e));
                    }
                    else {
                        console.error(`[WhatsApp Agent] WhatsApp API error [${(_a = error.response) === null || _a === void 0 ? void 0 : _a.status}]:`, (_b = error.response) === null || _b === void 0 ? void 0 : _b.data);
                        this.logService
                            .logError({
                            context: `sendReply:apiError:${(_d = (_c = error.response) === null || _c === void 0 ? void 0 : _c.status) !== null && _d !== void 0 ? _d : 'unknown'}`,
                            error,
                            phoneNumber: to,
                        })
                            .catch(e => console.error('[WhatsApp Agent] Failed to save error log:', e));
                    }
                }
                else {
                    console.error('[WhatsApp Agent] Unexpected error sending reply:', error);
                    this.logService
                        .logError({ context: 'sendReply:unexpected', error, phoneNumber: to })
                        .catch(e => console.error('[WhatsApp Agent] Failed to save error log:', e));
                }
            }
        });
    }
}
exports.WhatsAppAgentService = WhatsAppAgentService;
//# sourceMappingURL=tmp_head_service.js.map