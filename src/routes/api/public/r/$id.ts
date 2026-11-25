import { createFileRoute } from "@tanstack/react-router";

// Tracking link placed in each WhatsApp post: records a lead and opens a chat with the store.
export const Route = createFileRoute("/api/public/r/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!/^[0-9a-f-]{36}$/i.test(params.id)) return new Response("Link inválido", { status: 404 });
        const { getAdmin } = await import("@/server/engine.server");
        const admin = await getAdmin();
        const { data: device } = await admin.from("devices_catalog").select("id,user_id,model,storage,status").eq("id", params.id).maybeSingle();
        if (!device) return new Response("Anúncio não encontrado", { status: 404 });
        const { data: settings } = await admin.from("app_settings").select("store_whatsapp").eq("user_id", device.user_id).maybeSingle();
        await admin.from("leads").insert({ user_id: device.user_id, device_id: device.id });
        const code = device.id.slice(0, 6).toUpperCase();
        const text = device.status === "SOLD"
          ? `Olá! Vi o ${device.model} ${device.storage} (cód. ${code}), mas parece que esgotou. Tem outro parecido?`
          : `Olá! Tenho interesse no ${device.model} ${device.storage} (cód. ${code}). Ainda está disponível?`;
        const phone = String(settings?.store_whatsapp ?? "").replace(/\D/g, "");
        const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
        return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
      },
    },
  },
});
