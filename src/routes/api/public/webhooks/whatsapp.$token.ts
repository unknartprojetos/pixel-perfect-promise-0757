import { createFileRoute } from "@tanstack/react-router";

// Evolution API calls this URL. The long random token in the path identifies and authenticates the account.
export const Route = createFileRoute("/api/public/webhooks/whatsapp/$token")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const token = params.token;
        if (!/^[a-f0-9]{64}$/.test(token)) return new Response("Not found", { status: 404 });
        const { getAdmin, handleWebhook, processQueue } = await import("@/server/engine.server");
        const admin = await getAdmin();
        const { data: settings } = await admin.from("app_settings").select("*").eq("webhook_token", token).maybeSingle();
        if (!settings) return new Response("Not found", { status: 404 });
        let body: any;
        try {
          const raw = await request.text();
          if (raw.length > 8 * 1024 * 1024) return new Response("Too large", { status: 413 });
          body = JSON.parse(raw);
        } catch { return new Response("Bad JSON", { status: 400 }); }
        // When Evolution includes its global apikey, it must match the configured one.
        if (body?.apikey && settings.evolution_api_key && body.apikey !== settings.evolution_api_key) {
          // Instance-level keys differ from the global key; only reject if it also isn't a known instance.
          const { data: inst } = await admin.from("whatsapp_instances").select("id").eq("user_id", settings.user_id).eq("instance_name", body?.instance ?? "").maybeSingle();
          if (!inst) return new Response("Unauthorized", { status: 401 });
        }
        const origin = new URL(request.url).origin;
        try {
          const result = await handleWebhook(admin, settings, body, origin);
          // Opportunistically flush due sends for this account.
          processQueue(admin, { userId: settings.user_id, limit: 3 }).catch((e) => console.error(e));
          return Response.json(result);
        } catch (e: any) {
          console.error("webhook error", e);
          return new Response(String(e?.message ?? "error"), { status: 500 });
        }
      },
    },
  },
});
