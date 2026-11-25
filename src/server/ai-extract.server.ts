import { parseOfferRegex, type ParsedOffer } from "@/lib/parser";

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["is_offer", "modelo", "capacidade", "cor", "bateria", "condicao", "lacrado", "defeitos", "preco_custo"],
  properties: {
    is_offer: { type: "boolean", description: "true only if this is an iPhone being offered for sale with a price" },
    modelo: { type: "string", description: "Normalized, e.g. 'iPhone 14 Pro Max'" },
    capacidade: { type: "string", description: "e.g. '256GB' or '1TB'" },
    cor: { type: ["string", "null"] },
    bateria: { type: ["integer", "null"], description: "Battery health percent" },
    condicao: { type: ["string", "null"], description: "Impecável, Marcas leves, Marcas de uso, Lacrado..." },
    lacrado: { type: "boolean" },
    defeitos: { type: "array", items: { type: "string" }, description: "Short technical alerts in Portuguese, e.g. 'Tela trocada', 'Face ID OFF'" },
    preco_custo: { type: "number", description: "Supplier price in BRL" },
  },
};

/** Extract an iPhone offer using Lovable AI; falls back to regex when AI fails. */
export async function extractOffer(rawText: string): Promise<ParsedOffer & { source: "ai" | "regex" }> {
  const fallback = parseOfferRegex(rawText);
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { ...fallback, source: "regex" };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        messages: [
          { role: "system", content: "Você extrai anúncios de iPhones usados/lacrados de grupos de WhatsApp de fornecedores brasileiros. Se houver vários aparelhos, extraia o primeiro. Preços como '3.2k' = 3200, '3.250' = 3250. Responda somente com o JSON." },
          { role: "user", content: rawText.slice(0, 3000) },
        ],
        response_format: { type: "json_schema", json_schema: { name: "iphone_offer", strict: true, schema: SCHEMA } },
      }),
    });
    if (!res.ok) {
      console.error(`AI extract failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
      return { ...fallback, source: "regex" };
    }
    const json: any = await res.json();
    const o = JSON.parse(json.choices?.[0]?.message?.content ?? "{}");
    const out: ParsedOffer = {
      isValid: Boolean(o.is_offer && o.modelo && o.capacidade && o.preco_custo >= 300),
      model: String(o.modelo || fallback.model),
      storage: String(o.capacidade || fallback.storage).toUpperCase().replace(/\s/g, ""),
      color: o.cor ?? fallback.color,
      battery_health: o.bateria ?? fallback.battery_health,
      condition_grade: o.condicao ?? fallback.condition_grade,
      technical_alerts: Array.isArray(o.defeitos) ? o.defeitos.slice(0, 8) : fallback.technical_alerts,
      is_sealed: Boolean(o.lacrado),
      cost: Number(o.preco_custo) || fallback.cost,
    };
    return { ...out, source: "ai" };
  } catch (e) {
    console.error("AI extract error", e);
    return { ...fallback, source: "regex" };
  }
}
