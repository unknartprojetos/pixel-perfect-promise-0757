import { createFileRoute, Link } from "@tanstack/react-router";
import { Radar, Smartphone, Zap, BellOff, Calculator, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RepasseHub Pro — Arbitragem de iPhones no WhatsApp" },
      { name: "description", content: "Capture ofertas de iPhones dos grupos de fornecedores, aplique sua margem e publique nos seus grupos com baixa automática quando vender." },
      { property: "og:title", content: "RepasseHub Pro — Arbitragem de iPhones no WhatsApp" },
      { property: "og:description", content: "Radar de ofertas, margens automáticas e baixa instantânea de estoque nos seus grupos de WhatsApp." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: Smartphone, t: "Duas sessões reais", d: "Uma conta escuta os fornecedores, outra publica na sua loja. QR Code direto no painel." },
  { icon: Radar, t: "Radar com IA", d: "Cada oferta vira ficha técnica: modelo, bateria, estado, avisos e custo." },
  { icon: Calculator, t: "Margem automática", d: "Regras por linha, arredondamento em 90 e preço na maquininha em 12x." },
  { icon: BellOff, t: "Baixa instantânea", d: "Fornecedor reagiu ❌, disse “vendido” ou apagou? Seus grupos recebem ESGOTADO." },
  { icon: Zap, t: "Fila anti-ban", d: "Intervalos aleatórios entre envios e pausa noturna automática." },
  { icon: Users, t: "Leads & reservas", d: "Cada clique no anúncio vira lead, com lucro e atalho para o fornecedor." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"><Zap className="size-4" /></div>
          <span className="font-semibold">RepasseHub Pro</span>
        </div>
        <Button asChild variant="secondary" size="sm"><Link to="/auth">Entrar</Link></Button>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 md:pt-24">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Arbitragem de iPhones</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
          Revenda o estoque dos seus fornecedores sem nunca anunciar o que já vendeu.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          O RepasseHub lê os grupos de fornecedores, calcula sua margem, publica nos seus grupos e dá baixa sozinho no segundo em que o aparelho sai.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg"><Link to="/auth">Começar agora</Link></Button>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-xl border border-border bg-border px-0 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.t} className="bg-card p-6">
            <f.icon className="size-5 text-primary" />
            <h3 className="mt-4 font-medium">{f.t}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>
      <footer className="mx-auto max-w-6xl px-6 py-10 text-xs text-muted-foreground">© {new Date().getFullYear()} RepasseHub Pro</footer>
    </div>
  );
}
