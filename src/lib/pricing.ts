export type MarginCategory = "IPHONE_11_12" | "IPHONE_13_15" | "PRO_SERIES" | "SEALED";

export interface MarginRule {
  category_name: string;
  fixed_margin: number | string;
  round_to_90: boolean;
  is_active: boolean;
}

export const CATEGORY_LABELS: Record<MarginCategory, string> = {
  IPHONE_11_12: "iPhone 11 – 12",
  IPHONE_13_15: "iPhone 13 – 15+",
  PRO_SERIES: "Linha Pro / Pro Max",
  SEALED: "Lacrados",
};

/** Decide which margin rule applies to a device. Sealed wins, then Pro line, then by generation. */
export function categorize(model: string, sealed: boolean): MarginCategory {
  if (sealed) return "SEALED";
  if (/\bpro\b/i.test(model)) return "PRO_SERIES";
  const gen = Number(/(\d{1,2})/.exec(model)?.[1] ?? 0);
  if (gen > 0 && gen <= 12) return "IPHONE_11_12";
  return "IPHONE_13_15";
}

/** Round up to the next value ending in 90 (3200 -> 3290, 3290 -> 3290, 3291 -> 3390). */
export function roundTo90(value: number): number {
  return Math.ceil((value - 90) / 100) * 100 + 90;
}

/** Price on the card so the merchant nets the PIX price after the machine fee (rate in %). */
export function cardTotal(pix: number, ratePercent: number): number {
  if (!ratePercent || ratePercent <= 0) return pix;
  return Math.ceil(pix / (1 - ratePercent / 100));
}

export function computePrices(input: {
  cost: number;
  model: string;
  sealed: boolean;
  margins: MarginRule[];
  rate12: number;
}) {
  const category = categorize(input.model, input.sealed);
  const rule = input.margins.find((m) => m.category_name === category && m.is_active);
  const margin = rule ? Number(rule.fixed_margin) : 0;
  let pix = input.cost + margin;
  if (rule?.round_to_90 ?? true) pix = roundTo90(pix);
  const card12 = cardTotal(pix, input.rate12);
  return { category, margin_applied: pix - input.cost, final_price_pix: pix, final_price_card_12x: card12 };
}

export function brl(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export interface TemplateDevice {
  model: string;
  storage: string;
  color?: string | null;
  battery_health?: number | null;
  condition_grade?: string | null;
  technical_alerts?: string[] | null;
  final_price_pix: number | string;
  final_price_card_12x?: number | string | null;
}

export function renderTemplate(template: string, d: TemplateDevice, link: string): string {
  const card = d.final_price_card_12x ? Number(d.final_price_card_12x) : null;
  const alerts = (d.technical_alerts ?? []).map((a) => `⚠️ ${a}`).join("\n");
  const map: Record<string, string> = {
    modelo: d.model,
    capacidade: d.storage,
    cor: d.color || "—",
    bateria: d.battery_health ? `${d.battery_health}%` : "—",
    condicao: d.condition_grade || "—",
    avisos: alerts,
    preco_pix: brl(d.final_price_pix),
    preco_cartao: card ? `12x de ${brl(card / 12).replace(/\s/g, " ")} (${brl(card)})` : "—",
    link_whatsapp: link,
  };
  return template
    .replace(/\{(\w+)\}/g, (m, k: string) => (k in map ? (map[k] ?? "") : m))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
