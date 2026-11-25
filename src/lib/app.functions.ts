import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Role = z.enum(["LISTENER", "SENDER"]);

function origin() {
  const req = getRequest();
  const h = req.headers;
  const proto = h.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? new URL(req.url).host;
  return `${proto}://${host}`;
}

async function engine() { return import("@/server/engine.server"); }

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const e = await engine();
    const admin = await e.getAdmin();
    const settings = await e.loadSettings(admin, context.userId);
    const { data: instances } = await context.supabase.from("whatsapp_instances").select("*");
    const { data: groups } = await context.supabase.from("whatsapp_groups").select("*").order("name");
    return {
      settings: { ...settings, evolution_api_key: settings.evolution_api_key ? "••••••••" + String(settings.evolution_api_key).slice(-4) : "" , has_api_key: Boolean(settings.evolution_api_key) },
      webhookUrl: e.webhookUrl(origin(), settings),
      instances: instances ?? [],
      groups: groups ?? [],
    };
  });

export const saveGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ url: z.string().trim().url().max(300), apiKey: z.string().trim().max(300).optional() }))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { evolution_url: data.url.replace(/\/+$/, ""), updated_at: new Date().toISOString() };
    if (data.apiKey && !data.apiKey.startsWith("••")) patch["evolution_api_key"] = data.apiKey;
    const { error } = await context.supabase.from("app_settings").update(patch).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    autopilot: z.boolean().optional(),
    delay_min: z.number().int().min(10).max(600).optional(),
    delay_max: z.number().int().min(10).max(900).optional(),
    night_pause: z.boolean().optional(),
    store_whatsapp: z.string().trim().regex(/^\+?\d{10,15}$/, "Número com DDI e DDD, só dígitos").or(z.literal("")).optional(),
    message_template: z.string().min(10).max(2000).optional(),
    card_rates: z.record(z.string(), z.number().min(0).max(50)).optional(),
  }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("app_settings").update({ ...data, updated_at: new Date().toISOString() } as any).eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const connectSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ role: Role }))
  .handler(async ({ data, context }) => {
    const e = await engine();
    const { evo } = await import("@/server/evolution.server");
    const admin = await e.getAdmin();
    const settings = await e.loadSettings(admin, context.userId);
    const cfg = e.evoConfig(settings);
    const hook = e.webhookUrl(origin(), settings);
    let { data: inst } = await admin.from("whatsapp_instances").select("*").eq("user_id", context.userId).eq("role", data.role).maybeSingle();
    if (!inst) {
      const name = `rh_${context.userId.slice(0, 8)}_${data.role === "LISTENER" ? "monitor" : "loja"}`;
      const ins = await admin.from("whatsapp_instances").insert({ user_id: context.userId, role: data.role, instance_name: name }).select("*").single();
      if (ins.error) throw new Error(ins.error.message);
      inst = ins.data;
    }
    const existing = await evo.fetchInstance(cfg, inst.instance_name);
    if (!existing?.length) await evo.create(cfg, inst.instance_name, hook);
    else await evo.setWebhook(cfg, inst.instance_name, hook);
    const st = await evo.state(cfg, inst.instance_name).catch(() => null);
    if (st?.instance?.state === "open") {
      await admin.from("whatsapp_instances").update({ session_status: "CONNECTED", qr_code_base64: null }).eq("id", inst.id);
      return { status: "CONNECTED", qr: null };
    }
    const conn = await evo.connect(cfg, inst.instance_name);
    const qr = conn.base64 ?? null;
    await admin.from("whatsapp_instances").update({ session_status: "CONNECTING", qr_code_base64: qr, updated_at: new Date().toISOString() }).eq("id", inst.id);
    return { status: "CONNECTING", qr, pairingCode: conn.pairingCode ?? null };
  });

export const refreshSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ role: Role }))
  .handler(async ({ data, context }) => {
    const e = await engine();
    const { evo } = await import("@/server/evolution.server");
    const admin = await e.getAdmin();
    const settings = await e.loadSettings(admin, context.userId);
    const { data: inst } = await admin.from("whatsapp_instances").select("*").eq("user_id", context.userId).eq("role", data.role).maybeSingle();
    if (!inst) return { status: "DISCONNECTED" };
    const cfg = e.evoConfig(settings);
    const st = await evo.state(cfg, inst.instance_name).catch(() => null);
    const state = st?.instance?.state;
    const patch: any = { updated_at: new Date().toISOString() };
    if (state === "open") {
      patch.session_status = "CONNECTED"; patch.qr_code_base64 = null;
      const info = (await evo.fetchInstance(cfg, inst.instance_name).catch(() => []))?.[0];
      const owner = info?.ownerJid ?? info?.instance?.owner;
      if (owner) patch.phone_number = String(owner).split("@")[0];
      patch.profile_name = info?.profileName ?? info?.instance?.profileName ?? inst.profile_name;
      patch.profile_pic_url = info?.profilePicUrl ?? info?.instance?.profilePictureUrl ?? inst.profile_pic_url;
    } else if (state === "connecting") patch.session_status = "CONNECTING";
    else patch.session_status = "DISCONNECTED";
    await admin.from("whatsapp_instances").update(patch).eq("id", inst.id);
    return { status: patch.session_status };
  });

export const logoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ role: Role }))
  .handler(async ({ data, context }) => {
    const e = await engine();
    const { evo } = await import("@/server/evolution.server");
    const admin = await e.getAdmin();
    const settings = await e.loadSettings(admin, context.userId);
    const { data: inst } = await admin.from("whatsapp_instances").select("*").eq("user_id", context.userId).eq("role", data.role).maybeSingle();
    if (!inst) return { ok: true };
    await evo.logout(e.evoConfig(settings), inst.instance_name).catch(() => null);
    await admin.from("whatsapp_instances").update({ session_status: "DISCONNECTED", qr_code_base64: null }).eq("id", inst.id);
    return { ok: true };
  });

export const loadGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ role: Role }))
  .handler(async ({ data, context }) => {
    const e = await engine();
    const { evo } = await import("@/server/evolution.server");
    const admin = await e.getAdmin();
    const settings = await e.loadSettings(admin, context.userId);
    const { data: inst } = await admin.from("whatsapp_instances").select("*").eq("user_id", context.userId).eq("role", data.role).maybeSingle();
    if (!inst) throw new Error("Conecte a sessão primeiro.");
    const groups = await evo.groups(e.evoConfig(settings), inst.instance_name);
    const rows = (groups ?? []).filter((g: any) => g?.id).map((g: any) => ({
      user_id: context.userId, instance_id: inst.id, group_jid: g.id, name: g.subject || g.id,
      group_type: data.role === "LISTENER" ? "SOURCE" : "TARGET",
    }));
    if (rows.length) {
      const { error } = await admin.from("whatsapp_groups").upsert(rows, { onConflict: "instance_id,group_jid", ignoreDuplicates: false });
      if (error) throw new Error(error.message);
    }
    return { count: rows.length };
  });

export const toggleGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), active: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("whatsapp_groups").update({ is_active: data.active }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const parseManualOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ text: z.string().trim().min(5).max(3000) }))
  .handler(async ({ data, context }) => {
    const e = await engine();
    const admin = await e.getAdmin();
    const { device, parsed } = await e.createDeviceFromText(admin, context.userId, {
      text: data.text, groupJid: "manual", groupName: "Cadastro manual", messageId: `manual_${crypto.randomUUID()}`,
      senderJid: "manual", senderName: "Você",
    });
    if (!device) throw new Error(`Não reconheci um iPhone com preço nesse texto (modelo: ${parsed.model || "?"}, preço: ${parsed.cost || "?"}).`);
    return { id: device.id };
  });

export const updateDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid(),
    model: z.string().trim().min(3).max(100), storage: z.string().trim().min(2).max(30),
    color: z.string().trim().max(50).nullable(), battery_health: z.number().int().min(0).max(100).nullable(),
    condition_grade: z.string().trim().max(50).nullable(), technical_alerts: z.array(z.string().trim().max(60)).max(10),
    is_sealed: z.boolean(), supplier_cost: z.number().min(0).max(100000), final_price_pix: z.number().min(0).max(100000).nullable(),
  }))
  .handler(async ({ data, context }) => {
    const { computePrices, cardTotal } = await import("@/lib/pricing");
    const { data: margins } = await context.supabase.from("margin_settings").select("*");
    const { data: settings } = await context.supabase.from("app_settings").select("card_rates").single();
    const rate12 = Number((settings?.card_rates as any)?.["12"] ?? 0);
    let p = computePrices({ cost: data.supplier_cost, model: data.model, sealed: data.is_sealed, margins: (margins ?? []) as any, rate12 });
    if (data.final_price_pix) p = { ...p, final_price_pix: data.final_price_pix, margin_applied: data.final_price_pix - data.supplier_cost, final_price_card_12x: cardTotal(data.final_price_pix, rate12) };
    const { id, final_price_pix: _ignored, ...rest } = data;
    const { error } = await context.supabase.from("devices_catalog").update({
      ...rest, margin_applied: p.margin_applied, final_price_pix: p.final_price_pix, final_price_card_12x: p.final_price_card_12x,
    }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setDeviceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), status: z.enum(["AVAILABLE", "RESERVED", "DISCARDED"]) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("devices_catalog").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.status === "DISCARDED") await context.supabase.from("dispatch_queue").update({ status: "CANCELLED" }).eq("device_id", data.id).eq("status", "PENDING");
    return { ok: true };
  });

export const publishDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const e = await engine();
    const admin = await e.getAdmin();
    const r = await e.scheduleDispatch(admin, context.userId, data.id, origin());
    const sent = await e.processQueue(admin, { userId: context.userId, limit: 1 });
    return { ...r, ...sent };
  });

export const processMyQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const e = await engine();
    return e.processQueue(await e.getAdmin(), { userId: context.userId, limit: 5 });
  });

export const markSold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), reason: z.enum(["EMOJI_REACTION_X", "QUOTE_VENDIDO", "MANUAL"]) }))
  .handler(async ({ data, context }) => {
    const e = await engine();
    return e.triggerSoldRoutine(await e.getAdmin(), context.userId, { deviceId: data.id }, data.reason);
  });

export const simulateWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), kind: z.enum(["emoji", "vendido"]) }))
  .handler(async ({ data, context }) => {
    // Runs the exact webhook pipeline with a synthetic Evolution payload for this device.
    const e = await engine();
    const admin = await e.getAdmin();
    const settings = await e.loadSettings(admin, context.userId);
    const { data: device } = await admin.from("devices_catalog").select("*").eq("id", data.id).eq("user_id", context.userId).single();
    const { data: listener } = await admin.from("whatsapp_instances").select("*").eq("user_id", context.userId).eq("role", "LISTENER").maybeSingle();
    if (!device) throw new Error("Aparelho não encontrado");
    if (!listener || device.source_group_jid === "manual") {
      return e.triggerSoldRoutine(admin, context.userId, { deviceId: device.id }, data.kind === "emoji" ? "EMOJI_REACTION_X" : "QUOTE_VENDIDO");
    }
    const key = { remoteJid: device.source_group_jid, id: `SIM${Date.now()}`, participant: device.supplier_sender_jid, fromMe: false };
    const message = data.kind === "emoji"
      ? { reactionMessage: { key: { id: device.supplier_message_id }, text: "❌" } }
      : { extendedTextMessage: { text: "Vendido", contextInfo: { stanzaId: device.supplier_message_id } } };
    // Ensure the source group is treated as monitored for the simulation.
    await admin.from("whatsapp_groups").upsert({
      user_id: context.userId, instance_id: listener.id, group_jid: device.source_group_jid,
      name: device.source_group_name ?? device.source_group_jid, group_type: "SOURCE", is_active: true,
    }, { onConflict: "instance_id,group_jid", ignoreDuplicates: true });
    return e.handleWebhook(admin, settings, { event: "messages.upsert", instance: listener.instance_name, data: { key, message } }, origin());
  });

export const saveMargin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), fixed_margin: z.number().min(0).max(20000), round_to_90: z.boolean(), is_active: z.boolean() }))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("margin_settings").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ device_id: z.string().uuid(), customer_name: z.string().trim().min(1).max(100), customer_phone: z.string().trim().max(20).optional() }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("leads").insert({ ...data, user_id: context.userId, status: "RESERVED" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), customer_name: z.string().trim().max(100).nullable().optional(), customer_phone: z.string().trim().max(20).nullable().optional(), status: z.enum(["NEW", "RESERVED", "CANCELLED"]).optional() }))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("leads").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    if (rest.status === "RESERVED") {
      const { data: l } = await context.supabase.from("leads").select("device_id").eq("id", id).single();
      if (l?.device_id) await context.supabase.from("devices_catalog").update({ status: "RESERVED" }).eq("id", l.device_id).neq("status", "SOLD");
    }
    return { ok: true };
  });

export const confirmPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ lead_id: z.string().uuid(), sale_price: z.number().min(0).max(100000) }))
  .handler(async ({ data, context }) => {
    const { data: lead } = await context.supabase.from("leads").select("*, devices_catalog(*)").eq("id", data.lead_id).single();
    if (!lead) throw new Error("Lead não encontrado");
    const d: any = (lead as any).devices_catalog;
    if (!d) throw new Error("Este lead não tem aparelho vinculado");
    const cost = Number(d.supplier_cost);
    const { error } = await context.supabase.from("sales").insert({
      user_id: context.userId, device_id: d.id, lead_id: lead.id, description: `${d.model} ${d.storage}`,
      sale_price: data.sale_price, cost, profit: data.sale_price - cost,
    });
    if (error) throw new Error(error.message);
    await context.supabase.from("leads").update({ status: "PAID" }).eq("id", lead.id);
    const e = await engine();
    const r = await e.triggerSoldRoutine(await e.getAdmin(), context.userId, { deviceId: d.id }, "MANUAL");
    return { ok: true, replied: r.replied };
  });
