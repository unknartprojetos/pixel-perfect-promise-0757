import { Link, Outlet, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Radar, Smartphone, Boxes, Calculator, Users, LogOut, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/radar", label: "Radar de Ofertas", icon: Radar },
  { to: "/estoque", label: "Estoque & Baixas", icon: Boxes },
  { to: "/crm", label: "Reservas & Leads", icon: Users },
  { to: "/margens", label: "Margens & Copy", icon: Calculator },
  { to: "/conexoes", label: "Conexões WhatsApp", icon: Smartphone },
] as const;

export function AppShell() {
  const { user } = useRouteContext({ from: "/_authenticated" });
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"><Zap className="size-4" /></div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">RepasseHub</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pro</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent !text-sidebar-accent-foreground" }}>
              <n.icon className="size-4" />{n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="truncate px-2 pb-2 text-xs text-muted-foreground">{user.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}><LogOut className="size-4" />Sair</Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-1 overflow-x-auto border-b border-border bg-background/90 px-3 py-2 backdrop-blur md:hidden">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground"
              activeProps={{ className: "bg-accent !text-foreground" }}>
              <n.icon className="size-3.5" />{n.label.split(" ")[0]}
            </Link>
          ))}
          <Button variant="ghost" size="icon" className="ml-auto shrink-0" onClick={signOut} aria-label="Sair"><LogOut className="size-4" /></Button>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8"><Outlet /></main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
