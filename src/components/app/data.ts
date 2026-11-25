import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("app_settings").select("autopilot,delay_min,delay_max,night_pause,store_whatsapp,message_template,card_rates,evolution_url").single();
    if (error) throw error;
    return data;
  },
});

export const marginsQuery = queryOptions({
  queryKey: ["margins"],
  queryFn: async () => {
    const { data, error } = await supabase.from("margin_settings").select("*").order("fixed_margin");
    if (error) throw error;
    return data;
  },
});

export const devicesQuery = queryOptions({
  queryKey: ["devices"],
  queryFn: async () => {
    const { data, error } = await supabase.from("devices_catalog").select("*").order("created_at", { ascending: false }).limit(300);
    if (error) throw error;
    return data;
  },
});

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data } = await supabase.storage.from("device-media").createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const r of data ?? []) if (r.path && r.signedUrl) out[r.path] = r.signedUrl;
  return out;
}

export function errMsg(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
