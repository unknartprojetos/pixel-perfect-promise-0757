export interface ParsedOffer {
  isValid: boolean;
  model: string;
  storage: string;
  color: string | null;
  battery_health: number | null;
  condition_grade: string | null;
  technical_alerts: string[];
  is_sealed: boolean;
  cost: number;
}

const SOLD_WORDS = ["vendido", "já foi", "ja foi", "esgotou", "esgotado", "vendida"];
export const SOLD_EMOJIS = ["❌", "🔴", "🚫", "⛔"];

export function isSoldText(text: string): boolean {
  const t = text.toLowerCase();
  return SOLD_WORDS.some((w) => t.includes(w));
}

export function isIPhoneOffer(text: string): boolean {
  return /\b(iphone|ip)\s*\d{1,2}/i.test(text) && /\d{3,}/.test(text.replace(/\d{1,2}\s*(gb|tb)/gi, ""));
}

const COLORS = [
  "preto", "branco", "azul", "vermelho", "verde", "roxo", "rosa", "amarelo", "dourado", "prata",
  "grafite", "meia-noite", "meia noite", "estelar", "titânio natural", "titanio natural", "titânio azul",
  "titanio azul", "titânio preto", "titânio branco", "titânio deserto", "lilás", "lilas", "midnight", "starlight",
];

const ALERTS: [RegExp, string][] = [
  [/tela\s+trocada|tela\s+paralela|troca\s+de\s+tela/i, "Tela trocada"],
  [/face\s*id\s*(off|n[aã]o\s+funciona|desativado|com\s+defeito)/i, "Face ID OFF"],
  [/bateria\s+trocada|troca\s+de\s+bateria/i, "Bateria trocada"],
  [/pe[cç]a\s+desconhecida/i, "Peça desconhecida"],
  [/c[aâ]mera\s+(com\s+)?(defeito|mancha|trocada)/i, "Câmera com defeito"],
  [/true\s*tone\s*off/i, "True Tone OFF"],
  [/vitrine/i, "Vitrine"],
  [/trincad[oa]|rachad[oa]/i, "Trincado"],
];

function parseMoney(raw: string): number {
  let s = raw.trim().toLowerCase().replace(/r\$\s*/, "");
  const k = /k$/.test(s);
  s = s.replace(/k$/, "");
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else if (/^\d+\.\d{1,2}$/.test(s) && !k) s = s; // decimal
  let n = Number(s);
  if (k) n = n * 1000;
  return Number.isFinite(n) ? n : 0;
}

/** Fast regex extraction; used directly when AI is unavailable and as a sanity fallback. */
export function parseOfferRegex(text: string): ParsedOffer {
  const t = text.replace(/\*/g, "");
  const m = /\b(?:iphone|ip)\s*(\d{1,2})\s*(pro\s*max|pro|plus|mini|max|e)?\b/i.exec(t);
  let model = "";
  if (m) {
    const variant = (m[2] ?? "").toLowerCase().replace(/\s+/g, " ");
    const nice = variant === "pro max" || variant === "promax" ? "Pro Max" : variant ? variant[0]!.toUpperCase() + variant.slice(1) : "";
    model = `iPhone ${m[1]}${nice ? " " + nice : ""}`;
  }
  const st = /(\d{2,4})\s*(gb|g\b|tb)/i.exec(t);
  const storage = st ? (st[2]!.toLowerCase() === "tb" ? `${st[1]}TB` : `${st[1]}GB`) : "";
  const bat = /(?:bateria|bat|saúde|saude|🔋)?\s*:?\s*(\d{2,3})\s*%/i.exec(t);
  const battery = bat ? Math.min(100, Number(bat[1])) : null;
  const lower = t.toLowerCase();
  const color = COLORS.find((c) => lower.includes(c)) ?? null;
  const sealed = /lacrad[oa]/i.test(t);
  let condition: string | null = null;
  if (sealed) condition = "Lacrado";
  else if (/impec[aá]vel|perfeito|zero\s+marcas/i.test(t)) condition = "Impecável";
  else if (/marcas?\s+leves?|detalhes?\s+leves?/i.test(t)) condition = "Marcas leves";
  else if (/marcas?\s+de\s+uso|usad[oa]/i.test(t)) condition = "Marcas de uso";
  const alerts = ALERTS.filter(([re]) => re.test(t)).map(([, l]) => l);

  // Price: prefer amounts after R$ / valor / preço / 💰, else the largest 4-digit-ish number.
  let cost = 0;
  const pm = /(?:r\$|valor|pre[cç]o|💰|\$)\s*:?\s*([\d.,]+k?)/i.exec(t);
  if (pm) cost = parseMoney(pm[1]!);
  if (!cost) {
    const nums = [...t.matchAll(/\b(\d{1,2}\.\d{3}|\d{3,5})(?:,\d{2})?\b/g)]
      .map((x) => parseMoney(x[1]!))
      .filter((n) => n >= 300 && n <= 30000 && String(n) !== st?.[1]);
    cost = nums.length ? Math.max(...nums) : 0;
  }
  return {
    isValid: Boolean(model && storage && cost >= 300),
    model, storage, color: color ? color[0]!.toUpperCase() + color.slice(1) : null,
    battery_health: battery, condition_grade: condition, technical_alerts: alerts, is_sealed: sealed, cost,
  };
}
