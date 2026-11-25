// Evolution API (WhatsApp Baileys gateway) REST client. Server-only.
export interface EvoConfig { url: string; apiKey: string }

export class EvolutionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function call<T = any>(cfg: EvoConfig, method: string, path: string, body?: unknown): Promise<T> {
  const base = cfg.url.replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { apikey: cfg.apiKey, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    const msg = typeof json === "object" && json ? JSON.stringify(json.response?.message ?? json.message ?? json) : String(text);
    throw new EvolutionError(res.status, `Evolution API ${res.status}: ${msg.slice(0, 400)}`);
  }
  return json as T;
}

export const WEBHOOK_EVENTS = [
  "QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE",
];

export const evo = {
  fetchInstance: (c: EvoConfig, name: string) =>
    call<any[]>(c, "GET", `/instance/fetchInstances?instanceName=${encodeURIComponent(name)}`).catch((e) => {
      if (e instanceof EvolutionError && e.status === 404) return [];
      throw e;
    }),
  create: (c: EvoConfig, name: string, webhookUrl: string) =>
    call(c, "POST", "/instance/create", {
      instanceName: name, qrcode: true, integration: "WHATSAPP-BAILEYS",
      groupsIgnore: false, alwaysOnline: false, readMessages: false,
      webhook: { url: webhookUrl, byEvents: false, base64: true, events: WEBHOOK_EVENTS },
    }),
  setWebhook: (c: EvoConfig, name: string, webhookUrl: string) =>
    call(c, "POST", `/webhook/set/${name}`, {
      webhook: { enabled: true, url: webhookUrl, byEvents: false, base64: true, events: WEBHOOK_EVENTS },
    }),
  connect: (c: EvoConfig, name: string) => call<{ base64?: string; code?: string; pairingCode?: string }>(c, "GET", `/instance/connect/${name}`),
  state: (c: EvoConfig, name: string) => call<{ instance?: { state?: string } }>(c, "GET", `/instance/connectionState/${name}`),
  logout: (c: EvoConfig, name: string) => call(c, "DELETE", `/instance/logout/${name}`),
  groups: (c: EvoConfig, name: string) => call<any[]>(c, "GET", `/group/fetchAllGroups/${name}?getParticipants=false`),
  sendText: (c: EvoConfig, name: string, number: string, text: string, quotedId?: string) =>
    call<any>(c, "POST", `/message/sendText/${name}`, {
      number, text, ...(quotedId ? { quoted: { key: { id: quotedId } } } : {}),
    }),
  sendImage: (c: EvoConfig, name: string, number: string, mediaBase64: string, caption: string, mimetype = "image/jpeg") =>
    call<any>(c, "POST", `/message/sendMedia/${name}`, {
      number, mediatype: "image", mimetype, media: mediaBase64, caption, fileName: "aparelho.jpg",
    }),
  mediaBase64: (c: EvoConfig, name: string, message: unknown) =>
    call<{ base64?: string; mimetype?: string }>(c, "POST", `/chat/getBase64FromMediaMessage/${name}`, { message, convertToMp4: false }),
};
