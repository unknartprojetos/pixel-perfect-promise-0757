import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Send, Pencil, Eye, Trash2, Sparkles, Loader2, AlertTriangle, ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publishDevice, parseManualOffer, setDeviceStatus } from "@/lib/app.functions";
import { brl } from "@/lib/pricing";
import { PageHeader } from "@/components/app/AppShell";
import { devicesQuery, settingsQuery, signedUrls, errMsg } from "@/components/app/data";
import { CopyPreview, EditDevice } from "@/components/app/DeviceDialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/radar")({
  head: () => ({ meta: [{ title: "Radar de Ofertas — RepasseHub Pro" }, { name: "description", content: "Ofertas de iPhones capturadas em tempo real." }, { property: "og:title", content: "Radar de Ofertas — RepasseHub Pro" }, { property: "og:description", content: "Ofertas de iPhones capturadas em tempo real." }] }),
  component: RadarPage,
});

const FAMILIES = ["11", "12", "13", "14", "15", "16", "Pro", "Pro Max"];

function useDevicesRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const ch = supabase.channel(`devices-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "devices_catalog" }, (p) => {
        if (p.eventType === "INSERT") toast(`Nova oferta: ${(p.new as any).model} ${(p.new as any).storage}`);
        clearTimeout(t); t = setTimeout(() => qc.invalidateQueries({ queryKey: ["devices"] }), 400);
      }).subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  }, [qc]);
}

function RadarPage() {
  useDevicesRealtime();
  const devices = useQuery(devicesQuery);
  const settings = useQuery(settingsQuery);
  const [search, setSearch] = useState("");
  const [fams, setFams] = useState<string[]>([]);
  const [minBat, setMinBat] = useState(0);
  const [maxPrice, setMaxPrice] = useState("");
  const [showSold, setShowSold] = useState(false);

  const list = useMemo(() => (devices.data ?? []).filter((d) => {
    if (!showSold && ["SOLD", "DISCARDED"].includes(d.status)) return false;
    const hay = `${d.model} ${d.storage} ${d.color ?? ""} ${d.source_group_name ?? ""}`.toLowerCase();
    if (search && !hay.includes(search.toLowerCase())) return false;
    if (fams.length && !fams.some((f) => f === "Pro Max" ? /pro max/i.test(d.model) : f === "Pro" ? /\bpro\b/i.test(d.model) && !/pro max/i.test(d.model) : new RegExp(`\\b${f}\\b`).test(d.model))) return false;
    if (minBat && (d.battery_health ?? 0) < minBat) return false;
    if (maxPrice && Number(d.final_price_pix) > Number(maxPrice)) return false;
    return true;
  }), [devices.data, search, fams, minBat, maxPrice, showSold]);

  const paths = useMemo(() => list.flatMap((d) => d.media_urls?.slice(0, 1) ?? []), [list]);
  const urls = useQuery({ queryKey: ["signed", paths], queryFn: () => signedUrls(paths), enabled: paths.length > 0, staleTime: 30 * 60 * 1000 });

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Radar de Ofertas" subtitle="Aparelhos capturados dos grupos de fornecedores, já com sua margem." actions={<ManualAdd />} />
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        <Input placeholder="Buscar modelo, cor, grupo…" className="w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex flex-wrap gap-1">
          {FAMILIES.map((f) => (
            <button key={f} onClick={() => setFams(fams.includes(f) ? fams.filter((x) => x !== f) : [...fams, f])}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${fams.includes(f) ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>{f}</button>
          ))}
        </div>
        <div className="flex w-44 items-center gap-2 text-xs text-muted-foreground">🔋 ≥{minBat}%<Slider min={0} max={100} step={5} value={[minBat]} onValueChange={(v) => setMinBat(v[0]!)} /></div>
        <Input placeholder="Preço máx." inputMode="numeric" className="w-28" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))} />
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={showSold} onChange={(e) => setShowSold(e.target.checked)} />Mostrar vendidos</label>
      </div>

      {devices.isLoading ? <div className="text-sm text-muted-foreground">Carregando…</div> : list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <p className="font-medium">Nenhuma oferta por aqui ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Conecte a Sessão 1 e ative grupos de fornecedores, ou cole um anúncio em “Adicionar oferta”.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((d) => <DeviceCard key={d.id} d={{ ...d, _img: d.media_urls?.[0] ? urls.data?.[d.media_urls[0]] : undefined }} template={settings.data?.message_template ?? ""} />)}
        </div>
      )}
    </div>
  );
}

function statusBadge(s: string) {
  const map: Record<string, [string, string]> = {
    PENDING_APPROVAL: ["Aguardando aprovação", "bg-warning/15 text-warning"],
    AVAILABLE: ["Disponível", "bg-success/15 text-success"],
    RESERVED: ["Reservado", "bg-chart-2/20 text-chart-2"],
    SOLD: ["Vendido", "bg-destructive/15 text-destructive"],
    DISCARDED: ["Descartado", "bg-muted text-muted-foreground"],
  };
  const [l, c] = map[s] ?? [s, ""];
  return <Badge className={`${c} hover:${c}`}>{l}</Badge>;
}

function DeviceCard({ d, template }: { d: any; template: string }) {
  const publish = useServerFn(publishDevice);
  const setStatus = useServerFn(setDeviceStatus);
  const qc = useQueryClient();
  const [preview, setPreview] = useState(false);
  const [edit, setEdit] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [busy, setBusy] = useState(false);
  const bat = d.battery_health as number | null;
  const profit = Number(d.final_price_pix) - Number(d.supplier_cost);
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <button className="relative aspect-[4/3] bg-muted" onClick={() => d._img && setZoom(true)} aria-label="Ampliar foto">
        {d._img ? <img src={d._img} alt={d.model} className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted-foreground"><ImageOff className="size-6" /></div>}
        <div className="absolute left-2 top-2">{statusBadge(d.status)}</div>
      </button>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold leading-tight">{d.model}</h3>
            <p className="text-sm text-muted-foreground">{d.storage}{d.color ? ` · ${d.color}` : ""}</p>
          </div>
          {bat != null && <Badge className={bat >= 85 ? "bg-success/15 text-success hover:bg-success/15" : bat >= 80 ? "bg-warning/15 text-warning hover:bg-warning/15" : "bg-destructive/15 text-destructive hover:bg-destructive/15"}>🔋 {bat}%</Badge>}
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {d.condition_grade && <Badge variant="secondary">{d.condition_grade}</Badge>}
          {(d.technical_alerts ?? []).map((a: string) => <Badge key={a} className="bg-warning/10 text-warning hover:bg-warning/10"><AlertTriangle className="mr-1 size-3" />{a}</Badge>)}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">{d.source_group_name ?? "—"} · {d.supplier_name ?? d.supplier_sender_jid?.split("@")[0]}</div>
        <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-muted/50 p-2.5 text-center">
          <Price label="Custo" v={brl(d.supplier_cost)} />
          <Price label="Margem" v={`+${brl(profit)}`} className="text-primary" />
          <Price label="PIX" v={brl(d.final_price_pix)} strong />
          <Price label="12x" v={brl(d.final_price_card_12x)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" className="flex-1" disabled={busy || ["SOLD", "DISCARDED"].includes(d.status)} onClick={async () => {
            setBusy(true);
            try {
              const r = await publish({ data: { id: d.id } });
              toast.success(`${r.queued} envio(s) na fila${r.sent ? " · 1º enviado agora" : ""}`);
              if (r.failed) toast.error("O primeiro envio falhou. Veja a fila em Estoque.");
              qc.invalidateQueries({ queryKey: ["devices"] });
            } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
          }}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Publicar nos meus grupos</Button>
          <Button size="sm" variant="secondary" onClick={() => setPreview(true)} aria-label="Prévia da copy"><Eye className="size-4" /></Button>
          <Button size="sm" variant="secondary" onClick={() => setEdit(true)} aria-label="Editar detalhes"><Pencil className="size-4" /></Button>
          {d.status !== "DISCARDED" && d.status !== "SOLD" && (
            <Button size="sm" variant="ghost" aria-label="Descartar" onClick={async () => {
              try { await setStatus({ data: { id: d.id, status: "DISCARDED" } }); qc.invalidateQueries({ queryKey: ["devices"] }); toast("Oferta descartada"); }
              catch (e) { toast.error(errMsg(e)); }
            }}><Trash2 className="size-4" /></Button>
          )}
        </div>
      </div>
      {preview && <CopyPreview device={d} template={template} open={preview} onOpenChange={setPreview} />}
      {edit && <EditDevice device={d} open={edit} onOpenChange={setEdit} />}
      <Dialog open={zoom} onOpenChange={setZoom}><DialogContent className="max-w-3xl p-2"><img src={d._img} alt={d.model} className="w-full rounded" /></DialogContent></Dialog>
    </article>
  );
}

function Price({ label, v, strong, className = "" }: { label: string; v: string; strong?: boolean; className?: string }) {
  return <div><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className={`font-mono text-xs ${strong ? "font-semibold text-foreground" : ""} ${className}`}>{v}</div></div>;
}

function ManualAdd() {
  const parse = useServerFn(parseManualOffer);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}><Sparkles className="size-4" />Adicionar oferta</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <h2 className="font-semibold">Colar anúncio do fornecedor</h2>
          <p className="text-sm text-muted-foreground">A IA extrai modelo, bateria, estado, avisos e custo, e aplica sua margem.</p>
          <Textarea rows={7} placeholder={"iPhone 14 Pro Max 256GB Roxo\nBateria 88%\nImpecável, sem marcas\nR$ 4.350"} value={text} onChange={(e) => setText(e.target.value)} />
          <Button disabled={busy || text.trim().length < 5} onClick={async () => {
            setBusy(true);
            try { await parse({ data: { text } }); toast.success("Oferta adicionada ao radar"); setText(""); setOpen(false); qc.invalidateQueries({ queryKey: ["devices"] }); }
            catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
          }}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Extrair com IA</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
