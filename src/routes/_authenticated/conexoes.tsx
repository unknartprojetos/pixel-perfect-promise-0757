import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, QrCode, RefreshCw, LogOut, Users, ShieldCheck, Loader2 } from "lucide-react";
import { getOverview, saveGateway, saveSettings, connectSession, refreshSession, logoutSession, loadGroups, toggleGroup } from "@/lib/app.functions";
import { PageHeader } from "@/components/app/AppShell";
import { errMsg } from "@/components/app/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/conexoes")({
  head: () => ({ meta: [{ title: "Conexões WhatsApp — RepasseHub Pro" }, { name: "description", content: "Conecte as sessões de WhatsApp por QR Code." }, { property: "og:title", content: "Conexões WhatsApp — RepasseHub Pro" }, { property: "og:description", content: "Conecte as sessões de WhatsApp por QR Code." }] }),
  component: ConexoesPage,
});

type Role = "LISTENER" | "SENDER";

function ConexoesPage() {
  const fetchOverview = useServerFn(getOverview);
  const q = useQuery({ queryKey: ["overview"], queryFn: () => fetchOverview() });
  const qc = useQueryClient();
  const save = useServerFn(saveGateway);
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  useEffect(() => { if (q.data) { setUrl(q.data.settings.evolution_url ?? ""); setKey(q.data.settings.evolution_api_key ?? ""); } }, [q.data]);

  if (q.isLoading) return <div className="text-sm text-muted-foreground">Carregando…</div>;
  if (q.error) return <div className="text-sm text-destructive">{errMsg(q.error)}</div>;
  const data = q.data!;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Conexões WhatsApp" subtitle="Duas sessões reais via Evolution API: uma escuta fornecedores, outra publica na sua loja." />

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-medium">Gateway Evolution API</h2>
        <p className="mt-1 text-xs text-muted-foreground">Servidor que mantém o WhatsApp conectado (Railway, Render, VPS ou Docker).</p>
        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]" onSubmit={async (e) => {
          e.preventDefault();
          try { await save({ data: { url, apiKey: key } }); toast.success("Gateway salvo"); qc.invalidateQueries({ queryKey: ["overview"] }); }
          catch (err) { toast.error(errMsg(err)); }
        }}>
          <div className="space-y-1.5"><Label>EVOLUTION_API_URL</Label><Input placeholder="https://evolution.seudominio.com" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>EVOLUTION_API_KEY</Label><Input type="password" placeholder="Sua chave global" value={key} onChange={(e) => setKey(e.target.value)} /></div>
          <Button type="submit" className="self-end">Salvar</Button>
        </form>
        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground">URL do webhook (configurada automaticamente ao gerar o QR Code)</div>
          <div className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate font-mono text-xs">{data.webhookUrl}</code>
            <Button size="icon" variant="ghost" aria-label="Copiar" onClick={() => { navigator.clipboard.writeText(data.webhookUrl); toast.success("Copiado"); }}><Copy className="size-4" /></Button>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SessionCard role="LISTENER" title="Sessão 1 · Monitor de fornecedores" subtitle="Ative os grupos que devem ser lidos." data={data} disabled={!data.settings.has_api_key} />
        <SessionCard role="SENDER" title="Sessão 2 · Emissor da loja" subtitle="Ative os grupos que recebem suas postagens." data={data} disabled={!data.settings.has_api_key} />
      </div>

      <AntiBan settings={data.settings} />
    </div>
  );
}

function SessionCard({ role, title, subtitle, data, disabled }: { role: Role; title: string; subtitle: string; data: any; disabled: boolean }) {
  const qc = useQueryClient();
  const connect = useServerFn(connectSession);
  const refresh = useServerFn(refreshSession);
  const logout = useServerFn(logoutSession);
  const load = useServerFn(loadGroups);
  const toggle = useServerFn(toggleGroup);
  const inst = data.instances.find((i: any) => i.role === role);
  const groups = data.groups.filter((g: any) => inst && g.instance_id === inst.id);
  const [qr, setQr] = useState<string | null>(inst?.qr_code_base64 ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [countdown, setCountdown] = useState(0);
  const status: string = inst?.session_status ?? "DISCONNECTED";

  // While waiting for the scan: poll status every 4s and refresh the QR every 40s.
  useEffect(() => {
    if (status !== "CONNECTING" || !qr) return;
    setCountdown(40);
    const poll = setInterval(async () => {
      try {
        const r = await refresh({ data: { role } });
        if (r.status === "CONNECTED") { setQr(null); toast.success("WhatsApp conectado!"); qc.invalidateQueries({ queryKey: ["overview"] }); }
      } catch { /* keep polling */ }
    }, 4000);
    const tick = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [status, qr, role, refresh, qc]);

  useEffect(() => {
    if (countdown < 0 && status === "CONNECTING") doConnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  async function doConnect() {
    setBusy("qr");
    try {
      const r = await connect({ data: { role } });
      setQr(r.qr);
      if (r.status === "CONNECTED") toast.success("Sessão já está conectada");
      qc.invalidateQueries({ queryKey: ["overview"] });
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
  }

  const shown = groups.filter((g: any) => g.name.toLowerCase().includes(filter.toLowerCase()));
  const active = groups.filter((g: any) => g.is_active).length;

  return (
    <section className="flex flex-col rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-sm font-medium">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div>
        <StatusBadge status={status} />
      </div>

      {status === "CONNECTED" ? (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-muted/50 p-3">
          {inst?.profile_pic_url ? <img src={inst.profile_pic_url} alt="" className="size-10 rounded-full object-cover" /> : <div className="grid size-10 place-items-center rounded-full bg-secondary text-sm">{(inst?.profile_name ?? "W")[0]}</div>}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{inst?.profile_name ?? "Conta conectada"}</div>
            <div className="font-mono text-xs text-muted-foreground">+{inst?.phone_number ?? "—"}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={async () => { setBusy("out"); try { await logout({ data: { role } }); qc.invalidateQueries({ queryKey: ["overview"] }); toast("Sessão desconectada"); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); } }}>
            <LogOut className="size-4" />Desconectar
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-dashed border-border p-5">
          {qr ? (
            <>
              <img src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR Code de pareamento" className="size-56 rounded-lg bg-[#FFFFFF] p-2" />
              <p className="text-center text-xs text-muted-foreground">WhatsApp › Aparelhos conectados › Conectar aparelho<br />Atualiza em {Math.max(0, countdown)}s</p>
            </>
          ) : <QrCode className="size-10 text-muted-foreground" />}
          <Button onClick={doConnect} disabled={disabled || busy === "qr"}>
            {busy === "qr" ? <Loader2 className="size-4 animate-spin" /> : <QrCode className="size-4" />}
            {qr ? "Gerar novo QR Code" : "Gerar QR Code de Pareamento"}
          </Button>
          {disabled && <p className="text-xs text-warning">Salve a URL e a chave do gateway primeiro.</p>}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-2">
        <div className="text-sm font-medium">Grupos <span className="text-muted-foreground">· {active} ativos de {groups.length}</span></div>
        <Button size="sm" variant="secondary" disabled={status !== "CONNECTED" || busy === "groups"} onClick={async () => {
          setBusy("groups");
          try { const r = await load({ data: { role } }); toast.success(`${r.count} grupos carregados`); qc.invalidateQueries({ queryKey: ["overview"] }); }
          catch (e) { toast.error(errMsg(e)); } finally { setBusy(null); }
        }}>
          {busy === "groups" ? <Loader2 className="size-4 animate-spin" /> : <Users className="size-4" />}Carregar grupos da conta
        </Button>
      </div>
      {groups.length > 0 && <Input className="mt-3" placeholder="Filtrar grupos…" value={filter} onChange={(e) => setFilter(e.target.value)} />}
      <div className="mt-3 max-h-80 space-y-1 overflow-y-auto">
        {shown.map((g: any) => (
          <label key={g.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-accent">
            <span className="min-w-0 truncate text-sm">{g.name}</span>
            <Switch checked={g.is_active} onCheckedChange={async (v) => {
              try { await toggle({ data: { id: g.id, active: v } }); qc.invalidateQueries({ queryKey: ["overview"] }); }
              catch (e) { toast.error(errMsg(e)); }
            }} />
          </label>
        ))}
        {status === "CONNECTED" && groups.length === 0 && <p className="py-4 text-center text-xs text-muted-foreground">Clique em “Carregar grupos da conta”.</p>}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "CONNECTED") return <Badge className="bg-success/15 text-success hover:bg-success/15">● Conectado</Badge>;
  if (status === "CONNECTING") return <Badge className="bg-warning/15 text-warning hover:bg-warning/15">● Aguardando leitura</Badge>;
  return <Badge variant="secondary">○ Desconectado</Badge>;
}

function AntiBan({ settings }: { settings: any }) {
  const save = useServerFn(saveSettings);
  const qc = useQueryClient();
  const [range, setRange] = useState<[number, number]>([settings.delay_min, settings.delay_max]);
  async function patch(p: any, msg = "Configuração salva") {
    try { await save({ data: p }); toast.success(msg); qc.invalidateQueries({ queryKey: ["overview"] }); qc.invalidateQueries({ queryKey: ["settings"] }); }
    catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /><h2 className="text-sm font-medium">Segurança anti-ban & automação</h2></div>
      <div className="mt-5 grid gap-6 md:grid-cols-3">
        <div>
          <Label>Intervalo entre mensagens</Label>
          <div className="mt-1 font-mono text-sm">{range[0]}s – {range[1]}s</div>
          <Slider className="mt-3" min={10} max={300} step={5} value={range} onValueChange={(v) => setRange([v[0]!, v[1]!])}
            onValueCommit={(v) => patch({ delay_min: v[0], delay_max: v[1] })} />
        </div>
        <label className="flex items-start justify-between gap-3">
          <div><div className="text-sm font-medium">Pausa noturna</div><div className="text-xs text-muted-foreground">Sem disparos entre 23h e 07h30 (Brasília).</div></div>
          <Switch defaultChecked={settings.night_pause} onCheckedChange={(v) => patch({ night_pause: v })} />
        </label>
        <label className="flex items-start justify-between gap-3">
          <div><div className="text-sm font-medium">Piloto automático</div><div className="text-xs text-muted-foreground">Toda oferta capturada entra direto na fila de envio.</div></div>
          <Switch defaultChecked={settings.autopilot} onCheckedChange={(v) => patch({ autopilot: v }, v ? "Piloto automático ligado" : "Piloto automático desligado")} />
        </label>
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><RefreshCw className="size-3" />A fila é processada automaticamente a cada minuto.</p>
    </section>
  );
}
