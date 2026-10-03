import { Product } from "../types";
import { normalizeSemanticText } from "../utils/textUtils";

export type VoiceCommandAction =
  | "add"
  | "remove"
  | "increase"
  | "decrease"
  | "clear"
  | "search";

export type VoiceCommand = {
  action: VoiceCommandAction;
  quantity: number;
  query: string;
  raw: string;
  price?: number;
  currencyCode?: "CUP" | "USD" | "EUR" | "MN";
};

const ACTIONS: Record<VoiceCommandAction, string[]> = {
  add: ["agrega", "agregar", "agregame", "agrégame", "añade", "añadir", "anade", "anadir", "adiciona", "adicionar", "pon", "poner", "mete", "meter", "incorpora", "incorporar", "incluye", "incluir", "suma", "sumar", "echame", "échame", "dame"],
  remove: ["quita", "quitar", "elimina", "eliminar", "borra", "borrar", "saca", "sacar", "retira", "retirar"],
  increase: ["aumenta", "aumentar", "incrementa", "incrementar", "sube", "subir"],
  decrease: ["reduce", "reducir", "disminuye", "disminuir", "baja", "bajar"],
  clear: ["vacía", "vaciar", "vacia", "limpia", "limpiar", "borra todo", "elimina todo", "quitar todo"],
  search: ["busca", "buscar", "encuentra", "encontrar", "muestra", "mostrar", "localiza", "localizar", "filtra", "filtrar"],
};

const NUMBER_WORDS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
  trece: 13, catorce: 14, quince: 15, dieciseis: 16, dieciséis: 16,
  diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, treinta: 30,
  cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80,
  noventa: 90, cien: 100,
};

function normalize(value: string) {
  return normalizeSemanticText(value).replace(/\s+/g, " ").trim();
}

function extractQuantity(text: string): { quantity: number; text: string } {
  const match = text.match(/^(\d{1,4})\s+(.*)$/);
  if (match) return { quantity: Math.max(1, Number(match[1])), text: match[2] };

  const words = text.split(" ");
  if (words.length > 1 && NUMBER_WORDS[words[0]] !== undefined) {
    return { quantity: Math.max(1, NUMBER_WORDS[words[0]]), text: words.slice(1).join(" ") };
  }
  const last = words[words.length - 1];
  const trailingNumber = Number(last);
  if (words.length > 1 && /^\d{1,4}$/.test(last)) {
    return { quantity: Math.max(1, trailingNumber), text: words.slice(0, -1).join(" ") };
  }
  if (words.length > 1 && NUMBER_WORDS[last] !== undefined) {
    return { quantity: Math.max(1, NUMBER_WORDS[last]), text: words.slice(0, -1).join(" ") };
  }
  return { quantity: 1, text };
}

function parseSpokenPrice(text: string): { price?: number; currencyCode?: VoiceCommand["currencyCode"]; text: string } {
  // Price is intentionally parsed only when introduced by a clear phrase such as
  // "de 3700" / "a 3700" so a trailing quantity is never mistaken for a price.
  const match = text.match(/\b(?:de|a|por|precio|valor)\s+\$?\s*(\d{1,3}(?:[.\s]\d{3})*|\d+(?:[.,]\d+)?)\s*(cup|mn|usd|dolares?|euros?)?\b/i);
  if (!match) return { text };

  const rawNumber = match[1].replace(/\s/g, "");
  const hasDot = rawNumber.includes(".");
  const hasComma = rawNumber.includes(",");
  let normalizedNumber = rawNumber;

  if (hasDot && !hasComma && /\.\d{3}$/.test(rawNumber)) {
    normalizedNumber = rawNumber.replace(/\./g, "");
  } else if (hasDot && hasComma) {
    normalizedNumber = rawNumber.replace(/\./g, "").replace(",", ".");
  } else {
    normalizedNumber = rawNumber.replace(",", ".");
  }

  const price = Number(normalizedNumber);
  if (!Number.isFinite(price)) return { text };

  const codeRaw = (match[2] || "").toLowerCase();
  const currencyCode =
    codeRaw === "usd" || codeRaw.startsWith("dolar") ? "USD" :
    codeRaw === "eur" || codeRaw.startsWith("euro") ? "EUR" :
    codeRaw === "mn" ? "MN" :
    codeRaw === "cup" ? "CUP" :
    undefined;

  return {
    price,
    currencyCode,
    text: text.replace(match[0], " ").replace(/\s+/g, " ").trim(),
  };
}

function findAction(text: string): { action: VoiceCommandAction; rest: string } {
  const ordered = (Object.entries(ACTIONS) as [VoiceCommandAction, string[]][])
    .sort((a, b) => Math.max(...b[1].map(x => x.length)) - Math.max(...a[1].map(x => x.length)));

  for (const [action, phrases] of ordered) {
    for (const phrase of phrases) {
      if (text === phrase) return { action, rest: "" };
      if (text.startsWith(phrase + " ")) return { action, rest: text.slice(phrase.length).trim() };
    }
  }
  return { action: "search", rest: text };
}

export function parseVoiceCommand(input: string): VoiceCommand {
  const raw = input.trim();
  const normalized = normalize(raw);
  const { action, rest } = findAction(normalized);
  if (action === "clear") return { action, quantity: 1, query: "", raw };
  const priced = parseSpokenPrice(rest);
  const extracted = extractQuantity(priced.text);
  const query = extracted.text
    .replace(/^(de|del|la|el|los|las)\s+/i, "")
    .replace(/\s+(unidades?|uds?|piezas?|productos?)\s+(de|del)\s+/i, " ")
    .replace(/\s+(al|a la|en el|en la)\s+(carrito|carro|cesta)(\s+de\s+compras?)?$/i, "")
    .trim();
  return {
    action,
    quantity: extracted.quantity,
    query,
    raw,
    ...(priced.price !== undefined ? { price: priced.price } : {}),
    ...(priced.currencyCode ? { currencyCode: priced.currencyCode } : {}),
  };
}

function scoreProduct(product: Product, query: string, preferredPrice?: number): number {
  const q = normalize(query);
  const name = normalize(product.name || "");
  const sku = normalize(product.sku || "");
  const barcode = normalize(product.barcode || "");
  const id = normalize(product.id || "");
  if (!q) return 0;

  let score = 0;
  if (name === q || sku === q || barcode === q || id === q) score = 100;
  else if (name.startsWith(q)) score = 90;
  else if (sku.startsWith(q) || barcode.startsWith(q) || id.startsWith(q)) score = 88;
  else if (name.includes(q)) score = 75;
  else {
    const tokens = q.split(" ").filter(Boolean);
    const hits = tokens.filter(token => name.includes(token)).length;
    score = tokens.length ? Math.round((hits / tokens.length) * 65) : 0;
  }

  if (preferredPrice !== undefined && score > 0) {
    const productPrice = Number((product as Product & { price?: number }).price);
    if (Number.isFinite(productPrice)) {
      score += Math.abs(productPrice - preferredPrice) < 0.0001 ? 45 : -12;
    }
  }

  return score;
}

export function matchVoiceProducts(products: Product[], query: string, limit = 5, preferredPrice?: number): Product[] {
  return products
    .map(product => ({ product, score: scoreProduct(product, query, preferredPrice) }))
    .filter(x => x.score >= 50)
    .sort((a, b) => b.score - a.score || (a.product.name || "").localeCompare(b.product.name || ""))
    .slice(0, limit)
    .map(x => x.product);
}
