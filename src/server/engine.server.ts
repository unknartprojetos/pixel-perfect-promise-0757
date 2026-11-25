// Core business engine shared by the webhook, cron job and dashboard actions.
// Always receives the privileged client and an explicit userId; every query is scoped by user_id.
import { evo, type EvoConfig } from "./evolution.server";
import { extractOffer } from "./ai-extract.server";
import { computePrices, renderTemplate } from "@/lib/pricing";
import { isIPhoneOffer, isSoldText, SOLD_EMOJIS } from "@/lib/parser";
import { buildSlots, isNightTime, nextMorning } from "@/lib/schedule";

type Admin = any;

export async function getAdmin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function loadSettings(admin: Admin, userId: string) {
  const { data, error } = await admin.from("app_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;
  const ins = await admin.from("app_settings").insert({ user_id: userId }).select("*").single();
  if (ins.error) throw new Error(ins.error.message);
  return ins.data;
}

export function evoConfig(settings: any): EvoConfig {
  if (!settings?.evolution_url || !settings?.evolution_api_key) {
    throw new Error("Configure a URL e a API Key da Evolution API na tela de Conexões.");
  }
  return { url: settings.evolution_url, apiKey: settings.evolution_api_key };
}

export function webhookUrl(origin: string, settings: any) {
  return `${origin}/api/public/webhooks/whatsapp/${settings.webhook_token}`;
}

export function leadLink(origin: string, deviceId: string) {
  return `${origin}/api/public/r/${deviceId}`;
}

async function getInstance(admin: Admin, userId: string, role: "LISTENER" | "SENDER") {
  const { data } = await admin.from("whatsapp_instances").select("*").eq("user_id", userId).eq("role", role).maybeSingle();
  return data;
}

// ---------- Device creation ----------

export async function createDeviceFromText(admin: Admin, userId: string, input: {
  text: string; groupJid: string; groupName?: string | null; messageId: string; senderJid: string; senderName?: string | null;
  mediaPaths?: string[];
}) {
  const parsed = await extractOffer(input.text);
  if (!parsed.isValid) return { device: null, parsed };
  const settings = await loadSettings(admin, userId);
  const { data: margins } = await admin.from("margin_settings").select("*").eq("user_id", userId);
  const rate12 = Number(settings.card_rates?.["12"] ?? 0);
  const prices = computePrices({ cost: parsed.cost, model: parsed.model, sealed: parsed.is_sealed, margins: margins ?? [], rate12 });
  const status = settings.autopilot ? "AVAILABLE" : "PENDING_APPROVAL";
  const { data, error } = await admin.from("devices_catalog").upsert({
    user_id: userId,
    source_group_jid: input.groupJid, source_group_name: input.groupName ?? null,
    supplier_message_id: input.messageId, supplier_sender_jid: input.senderJid, supplier_name: input.senderName ?? null,
    raw_text: input.text.slice(0, 4000),
    model: parsed.model, storage: parsed.storage, color: parsed.color, battery_health: parsed.battery_health,
    condition_grade: parsed.condition_grade, is_sealed: parsed.is_sealed, technical_alerts: parsed.technical_alerts,
    media_urls: input.mediaPaths ?? [],
    supplier_cost: parsed.cost, margin_applied: prices.margin_applied,
    final_price_pix: prices.final_price_pix, final_price_card_12x: prices.final_price_card_12x,
    status,
  }, { onConflict: "user_id,supplier_message_id" }).select("*").single();
  if (error) throw new Error(error.message);
  return { device: data, parsed };
}

// ---------- Dispatch queue ----------

export async function scheduleDispatch(admin: Admin, userId: string, deviceId: string, origin: string) {
  const settings = await loadSettings(admin, userId);
  const sender = await getInstance(admin, userId, "SENDER");
  if (!sender) throw new Error("Conecte a Sessão 2 (Emissor) antes de publicar.");
  const { data: device } = await admin.from("devices_catalog").select("*").eq("id", deviceId).eq("user_id", userId).single();
  if (!device) throw new Error("Aparelho não encontrado.");
  if (device.status === "SOLD" || device.status === "DISCARDED") throw new Error("Este aparelho não está disponível.");
  const { data: targets } = await admin.from("whatsapp_groups").select("*")
    .eq("user_id", userId).eq("instance_id", sender.id).eq("group_type", "TARGET").eq("is_active", true);
  if (!targets?.length) throw new Error("Selecione ao menos um grupo de destino na Sessão 2.");

  const caption = renderTemplate(settings.message_template, device, leadLink(origin, device.id));
  const { data: last } = await admin.from("dispatch_queue").select("scheduled_for")
    .eq("user_id", userId).in("status", ["PENDING", "PROCESSING"]).order("scheduled_for", { ascending: false }).limit(1);
  const now = new Date();
  let start = now;
  if (last?.[0]) {
    const lastAt = new Date(last[0].scheduled_for);
    const gap = (settings.delay_min + Math.random() * (settings.delay_max - settings.delay_min)) * 1000;
    if (lastAt.getTime() + gap > now.getTime()) start = new Date(lastAt.getTime() + gap);
  }
  const slots = buildSlots({ start, count: targets.length, delayMin: settings.delay_min, delayMax: settings.delay_max, nightPause: settings.night_pause });
  const rows = targets.map((g: any, i: number) => ({
    user_id: userId, device_id: device.id, target_group_jid: g.group_jid, target_group_name: g.name,
    payload_caption: caption, media_url: device.media_urls?.[0] ?? null, scheduled_for: slots[i]!.toISOString(),
  }));
  const { error } = await admin.from("dispatch_queue").insert(rows);
  if (error) throw new Error(error.message);
  if (device.status === "PENDING_APPROVAL") await admin.from("devices_catalog").update({ status: "AVAILABLE" }).eq("id", device.id);
  return { queued: rows.length, firstAt: slots[0]!.toISOString() };
}

async function storageBase64(admin: Admin, path: string): Promise<{ b64: string; mime: string } | null> {
  const { data, error } = await admin.storage.from("device-media").download(path);
  if (error || !data) return null;
  const buf = Buffer.from(await data.arrayBuffer());
  return { b64: buf.toString("base64"), mime: data.type || "image/jpeg" };
}

/** Send due queue items. If userId is omitted, processes all users (cron). */
export async function processQueue(admin: Admin, opts: { userId?: string; limit?: number } = {}) {
  const nowIso = new Date().toISOString();
  let q = admin.from("dispatch_queue").select("*").eq("status", "PENDING").lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true }).limit(opts.limit ?? 10);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  const { data: due, error } = await q;
  if (error) throw new Error(error.message);
  const results = { sent: 0, failed: 0, skipped: 0 };
  const sentUsers = new Set<string>();

  for (const item of due ?? []) {
    // One message per user per run keeps the anti-ban spacing even if the cron fell behind.
    if (sentUsers.has(item.user_id)) continue;
    const claim = await admin.from("dispatch_queue").update({ status: "PROCESSING", attempts: item.attempts + 1 })
      .eq("id", item.id).eq("status", "PENDING").select("id");
    if (!claim.data?.length) continue;
    try {
      const settings = await loadSettings(admin, item.user_id);
      if (settings.night_pause && isNightTime(new Date())) {
        await admin.from("dispatch_queue").update({ status: "PENDING", attempts: item.attempts, scheduled_for: nextMorning(new Date()).toISOString() }).eq("id", item.id);
        results.skipped++; continue;
      }
      const { data: device } = await admin.from("devices_catalog").select("status").eq("id", item.device_id).single();
      if (!device || ["SOLD", "DISCARDED"].includes(device.status)) {
        await admin.from("dispatch_queue").update({ status: "CANCELLED", error_message: "Aparelho indisponível" }).eq("id", item.id);
        results.skipped++; continue;
      }
      const sender = await getInstance(admin, item.user_id, "SENDER");
      if (!sender) throw new Error("Sessão emissora não configurada");
      const cfg = evoConfig(settings);
      let resp: any;
      const media = item.media_url ? await storageBase64(admin, item.media_url) : null;
      if (media) resp = await evo.sendImage(cfg, sender.instance_name, item.target_group_jid, media.b64, item.payload_caption, media.mime);
      else resp = await evo.sendText(cfg, sender.instance_name, item.target_group_jid, item.payload_caption);
      const msgId = resp?.key?.id ?? resp?.message?.key?.id;
      if (!msgId) throw new Error("WhatsApp não retornou o ID da mensagem");
      await admin.from("dispatched_posts").insert({
        user_id: item.user_id, device_id: item.device_id, target_group_jid: item.target_group_jid,
        target_group_name: item.target_group_name, sent_message_id: msgId,
      });
      await admin.from("dispatch_queue").update({ status: "SENT", error_message: null }).eq("id", item.id);
      sentUsers.add(item.user_id);
      results.sent++;
    } catch (e: any) {
      const attempts = item.attempts + 1;
      const retry = attempts < 3;
      await admin.from("dispatch_queue").update({
        status: retry ? "PENDING" : "FAILED", error_message: String(e?.message ?? e).slice(0, 500),
        scheduled_for: retry ? new Date(Date.now() + 120000 * attempts).toISOString() : item.scheduled_for,
      }).eq("id", item.id);
      results.failed++;
    }
  }
  return results;
}

// ---------- Sold routine ----------

export async function triggerSoldRoutine(admin: Admin, userId: string, ref: { supplierMsgId?: string; deviceId?: string }, reason: string) {
  let q = admin.from("devices_catalog").select("*").eq("user_id", userId);
  q = ref.deviceId ? q.eq("id", ref.deviceId) : q.eq("supplier_message_id", ref.supplierMsgId);
  const { data: device } = await q.maybeSingle();
  if (!device || device.status === "SOLD") return { handled: false, replied: 0 };

  await admin.from("devices_catalog").update({ status: "SOLD", sold_detected_at: new Date().toISOString(), sold_reason: reason }).eq("id", device.id);
  await admin.from("dispatch_queue").update({ status: "CANCELLED", error_message: `Baixa: ${reason}` })
    .eq("device_id", device.id).eq("status", "PENDING");

  const { data: posts } = await admin.from("dispatched_posts").select("*").eq("device_id", device.id).eq("status", "ACTIVE");
  let replied = 0;
  const errors: string[] = [];
  if (posts?.length) {
    const settings = await loadSettings(admin, userId);
    const sender = await getInstance(admin, userId, "SENDER");
    if (sender && settings.evolution_url) {
      const cfg = evoConfig(settings);
      for (const p of posts) {
        try {
          await evo.sendText(cfg, sender.instance_name, p.target_group_jid, "❌ *ESGOTADO!* Este aparelho acabou de ser vendido.", p.sent_message_id);
          await admin.from("dispatched_posts").update({ status: "MARK_SOLD_REPLIED" }).eq("id", p.id);
          replied++;
        } catch (e: any) { errors.push(String(e?.message ?? e)); }
      }
    }
  }
  return { handled: true, replied, errors };
}

// ---------- Webhook processing ----------

function normEvent(e: string) { return String(e || "").toLowerCase().replace(/_/g, "."); }

function textOf(message: any): string {
  return message?.conversation || message?.extendedTextMessage?.text || message?.imageMessage?.caption || message?.videoMessage?.caption || "";
}

export async function handleWebhook(admin: Admin, settings: any, body: any, origin: string) {
  const userId = settings.user_id as string;
  const event = normEvent(body?.event);
  const instanceName: string = body?.instance ?? body?.instanceName ?? "";
  const { data: instance } = await admin.from("whatsapp_instances").select("*").eq("user_id", userId).eq("instance_name", instanceName).maybeSingle();
  if (!instance) return { ignored: "unknown instance" };
  const data = body?.data ?? {};

  if (event === "qrcode.updated") {
    const b64 = data?.qrcode?.base64 ?? data?.base64;
    if (b64) await admin.from("whatsapp_instances").update({ qr_code_base64: b64, session_status: "CONNECTING", updated_at: new Date().toISOString() }).eq("id", instance.id);
    return { ok: true };
  }
  if (event === "connection.update") {
    const state = data?.state;
    const status = state === "open" ? "CONNECTED" : state === "connecting" ? "CONNECTING" : "DISCONNECTED";
    const patch: any = { session_status: status, updated_at: new Date().toISOString() };
    if (status === "CONNECTED") patch.qr_code_base64 = null;
    if (data?.wuid) patch.phone_number = String(data.wuid).split("@")[0];
    if (data?.profileName) patch.profile_name = data.profileName;
    if (data?.profilePictureUrl) patch.profile_pic_url = data.profilePictureUrl;
    await admin.from("whatsapp_instances").update(patch).eq("id", instance.id);
    return { ok: true };
  }

  if (instance.role !== "LISTENER") return { ignored: "sender instance" };

  const sourceGroups = async () => {
    const { data: g } = await admin.from("whatsapp_groups").select("group_jid,name")
      .eq("user_id", userId).eq("instance_id", instance.id).eq("group_type", "SOURCE").eq("is_active", true);
    return new Map<string, string>((g ?? []).map((x: any) => [x.group_jid, x.name]));
  };

  if (event === "messages.delete") {
    const id = data?.key?.id ?? data?.id;
    if (id) return triggerSoldRoutine(admin, userId, { supplierMsgId: id }, "SOURCE_DELETED");
    return { ok: true };
  }

  if (event === "messages.reaction") {
    const id = data?.key?.id ?? data?.reaction?.key?.id;
    const emoji = data?.reaction?.text ?? data?.text;
    if (id && SOLD_EMOJIS.includes(emoji)) return triggerSoldRoutine(admin, userId, { supplierMsgId: id }, "EMOJI_REACTION_X");
    return { ok: true };
  }

  if (event === "messages.update") {
    const list = Array.isArray(data) ? data : [data];
    for (const u of list) {
      const st = String(u?.status ?? u?.update?.status ?? "");
      const id = u?.keyId ?? u?.key?.id;
      if (id && (st === "DELETED" || u?.update?.message === null)) await triggerSoldRoutine(admin, userId, { supplierMsgId: id }, "SOURCE_DELETED");
    }
    return { ok: true };
  }

  if (event === "messages.upsert") {
    const list = Array.isArray(data) ? data : Array.isArray(data?.messages) ? data.messages : [data];
    const groups = await sourceGroups();
    const out: any[] = [];
    for (const msg of list) {
      const jid: string = msg?.key?.remoteJid ?? "";
      if (!jid.endsWith("@g.us") || !groups.has(jid)) continue;
      const m = msg.message ?? {};

      if (m.reactionMessage) {
        if (SOLD_EMOJIS.includes(m.reactionMessage.text)) out.push(await triggerSoldRoutine(admin, userId, { supplierMsgId: m.reactionMessage.key?.id }, "EMOJI_REACTION_X"));
        continue;
      }
      if (m.protocolMessage && (m.protocolMessage.type === 0 || m.protocolMessage.type === "REVOKE")) {
        out.push(await triggerSoldRoutine(admin, userId, { supplierMsgId: m.protocolMessage.key?.id }, "SOURCE_DELETED"));
        continue;
      }
      const text = textOf(m);
      const quotedId = m.extendedTextMessage?.contextInfo?.stanzaId;
      if (quotedId && isSoldText(text)) {
        out.push(await triggerSoldRoutine(admin, userId, { supplierMsgId: quotedId }, "QUOTE_VENDIDO"));
        continue;
      }
      if (!text || !isIPhoneOffer(text)) continue;

      const mediaPaths: string[] = [];
      if (m.imageMessage) {
        try {
          let b64: string | undefined = m.base64 ?? msg.base64;
          let mime: string = m.imageMessage.mimetype ?? "image/jpeg";
          if (!b64) {
            const r = await evo.mediaBase64(evoConfig(settings), instance.instance_name, msg);
            b64 = r.base64; mime = r.mimetype ?? mime;
          }
          if (b64) {
            const path = `${userId}/${msg.key.id}.jpg`;
            const up = await admin.storage.from("device-media").upload(path, Buffer.from(b64, "base64"), { contentType: mime, upsert: true });
            if (!up.error) mediaPaths.push(path);
          }
        } catch (e) { console.error("media download failed", e); }
      }
      const { device } = await createDeviceFromText(admin, userId, {
        text, groupJid: jid, groupName: groups.get(jid), messageId: msg.key.id,
        senderJid: msg.key.participant ?? msg.participant ?? jid, senderName: msg.pushName, mediaPaths,
      });
      if (device && settings.autopilot) {
        try { await scheduleDispatch(admin, userId, device.id, origin); } catch (e) { console.error("autopilot schedule failed", e); }
      }
      out.push({ device: device?.id ?? null });
    }
    return { ok: true, processed: out.length };
  }
  return { ignored: event };
}
