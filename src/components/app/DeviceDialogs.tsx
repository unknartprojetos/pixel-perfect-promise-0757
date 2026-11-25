import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateDevice } from "@/lib/app.functions";
import { renderTemplate } from "@/lib/pricing";
import { errMsg } from "./data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function CopyPreview({ device, template, open, onOpenChange }: { device: any; template: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const link = typeof window !== "undefined" ? `${window.location.origin}/api/public/r/${device.id}` : "";
  const text = renderTemplate(template, device, link);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Prévia no WhatsApp</DialogTitle></DialogHeader>
        <div className="rounded-xl bg-whatsapp/60 p-4">
          <div className="ml-auto max-w-[90%] rounded-lg rounded-tr-none bg-whatsapp p-2 text-whatsapp-foreground shadow">
            {device._img && <img src={device._img} alt="" className="mb-2 max-h-60 w-full rounded object-cover" />}
            <WhatsText text={text} />
            <div className="mt-1 text-right text-[10px] opacity-60">agora ✓✓</div>
          </div>
        </div>
        <DialogFooter><Button variant="secondary" onClick={() => { navigator.clipboard.writeText(text); toast.success("Copy copiada"); }}>Copiar texto</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WhatsText({ text }: { text: string }) {
  return (
    <div className="whitespace-pre-wrap break-words text-sm">
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        part.startsWith("*") && part.endsWith("*") ? <strong key={i}>{part.slice(1, -1)}</strong> : <span key={i}>{part}</span>)}
    </div>
  );
}

export function EditDevice({ device, open, onOpenChange }: { device: any; open: boolean; onOpenChange: (v: boolean) => void }) {
  const save = useServerFn(updateDevice);
  const qc = useQueryClient();
  const [f, setF] = useState(() => ({
    model: device.model, storage: device.storage, color: device.color ?? "", battery: device.battery_health?.toString() ?? "",
    condition: device.condition_grade ?? "", alerts: (device.technical_alerts ?? []).join(", "), sealed: device.is_sealed,
    cost: String(device.supplier_cost), pix: String(device.final_price_pix),
  }));
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  async function submit() {
    setBusy(true);
    try {
      const cost = Number(f.cost);
      const pix = Number(f.pix);
      await save({ data: {
        id: device.id, model: f.model, storage: f.storage, color: f.color || null,
        battery_health: f.battery ? Number(f.battery) : null, condition_grade: f.condition || null,
        technical_alerts: f.alerts.split(",").map((s: string) => s.trim()).filter(Boolean), is_sealed: f.sealed,
        supplier_cost: cost, final_price_pix: pix && pix !== Number(device.final_price_pix) ? pix : (cost !== Number(device.supplier_cost) ? null : pix),
      } });
      toast.success("Aparelho atualizado");
      qc.invalidateQueries({ queryKey: ["devices"] });
      onOpenChange(false);
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar detalhes</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Modelo"><Input value={f.model} onChange={set("model")} /></Field>
          <Field label="Capacidade"><Input value={f.storage} onChange={set("storage")} /></Field>
          <Field label="Cor"><Input value={f.color} onChange={set("color")} /></Field>
          <Field label="Bateria (%)"><Input inputMode="numeric" value={f.battery} onChange={set("battery")} /></Field>
          <Field label="Estado"><Input value={f.condition} onChange={set("condition")} /></Field>
          <Field label="Avisos (separados por vírgula)"><Input value={f.alerts} onChange={set("alerts")} /></Field>
          <Field label="Custo do fornecedor (R$)"><Input inputMode="decimal" value={f.cost} onChange={set("cost")} /></Field>
          <Field label="Preço final PIX (R$)"><Input inputMode="decimal" value={f.pix} onChange={set("pix")} /></Field>
          <label className="col-span-2 flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">Lacrado<Switch checked={f.sealed} onCheckedChange={(v) => setF({ ...f, sealed: v })} /></label>
        </div>
        <p className="text-xs text-muted-foreground">Mudou só o custo? O preço é recalculado pela regra de margem.</p>
        <DialogFooter><Button onClick={submit} disabled={busy}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
