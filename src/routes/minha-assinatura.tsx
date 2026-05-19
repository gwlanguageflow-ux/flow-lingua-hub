import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock,
  CreditCard,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/minha-assinatura")({
  head: () => ({ meta: [{ title: "Minha Assinatura — GWLanguageFlow" }] }),
  component: () => (
    <RequireAuth>
      <Page />
    </RequireAuth>
  ),
});

interface SubRow {
  id: string;
  status: string;
  payment_method: "card" | "pix" | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  last_payment_at: string | null;
  terms_accepted_at: string;
  created_at: string;
  plan: {
    name: string;
    price: number;
    interval: string;
    description: string | null;
    features: string[];
  } | null;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  ativa: { label: "Ativa", cls: "bg-green-100 text-green-800" },
  pendente: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  inadimplente: { label: "Inadimplente", cls: "bg-red-100 text-red-800" },
  cancelada: { label: "Cancelada", cls: "bg-zinc-200 text-zinc-700" },
  expirada: { label: "Expirada", cls: "bg-zinc-200 text-zinc-700" },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function Page() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sub, setSub] = useState<SubRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("student_subscriptions")
      .select(
        "id, status, payment_method, current_period_start, current_period_end, cancel_at_period_end, last_payment_at, terms_accepted_at, created_at, plan:subscription_plans(name, price, interval, description, features)",
      )
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setSub((data as unknown as SubRow) ?? null);
        setLoading(false);
      });
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-bronze" />
      </div>
    );
  }

  return (
    <div className="gw-app-shell flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl">
        <div className="gw-command-hero mb-6 rounded-xl p-6 md:p-8">
          <p className="gw-section-kicker">Conta</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-wine md:text-4xl">
            Minha assinatura
          </h1>
          <p className="mt-2 text-sm leading-6 text-brown-soft">
            Acompanhe status, período, forma de pagamento e itens liberados pelo seu plano.
          </p>
        </div>

        {!sub ? (
          <div className="gw-empty-state rounded-xl p-10 text-center shadow-soft">
            <h2 className="font-display text-xl text-wine">Você ainda não tem uma assinatura</h2>
            <p className="text-brown mt-2">Escolha um plano para começar a agendar aulas.</p>
            <Link to="/planos">
              <Button className="mt-6 bg-bronze text-white hover:bg-wine shadow-bronze">
                Ver planos
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="gw-app-card rounded-xl p-6 shadow-soft md:p-8">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-wider text-brown-soft">Plano atual</p>
                  <h2 className="font-display text-2xl text-wine font-bold mt-1">
                    {sub.plan?.name ?? "—"}
                  </h2>
                  {sub.plan?.description && (
                    <p className="text-sm text-brown mt-1">{sub.plan.description}</p>
                  )}
                </div>
                <Badge className={STATUS_META[sub.status]?.cls ?? "bg-zinc-100 text-zinc-700"}>
                  {STATUS_META[sub.status]?.label ?? sub.status}
                </Badge>
              </div>

              {sub.status === "inadimplente" && (
                <div className="mt-5 flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-800">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Pagamento em atraso</p>
                    <p>
                      Seu acesso para agendar novas aulas está suspenso. Atualize a forma de
                      pagamento ou contrate um novo plano.
                    </p>
                    <Button
                      onClick={() => navigate({ to: "/planos" })}
                      className="mt-3 bg-wine text-white hover:bg-wine/90 h-9"
                    >
                      Regularizar
                    </Button>
                  </div>
                </div>
              )}

              {sub.status === "pendente" && (
                <div className="mt-5 flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                  <Loader2 className="h-5 w-5 mt-0.5 flex-shrink-0 animate-spin" />
                  <p>Aguardando confirmação do pagamento. Pode levar alguns minutos.</p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4 mt-6 text-sm">
                <Info
                  icon={<CreditCard className="h-4 w-4" />}
                  label="Valor"
                  value={
                    sub.plan ? `${fmtBRL(Number(sub.plan.price))} / ${sub.plan.interval}` : "—"
                  }
                />
                <Info
                  icon={
                    sub.payment_method === "pix" ? (
                      <QrCode className="h-4 w-4" />
                    ) : (
                      <CreditCard className="h-4 w-4" />
                    )
                  }
                  label="Forma de pagamento"
                  value={
                    sub.payment_method === "pix"
                      ? "Pix Automático"
                      : sub.payment_method === "card"
                        ? "Cartão (recorrente)"
                        : "—"
                  }
                />
                <Info
                  icon={<CalendarClock className="h-4 w-4" />}
                  label="Início do período"
                  value={fmtDate(sub.current_period_start)}
                />
                <Info
                  icon={<CalendarClock className="h-4 w-4" />}
                  label={sub.payment_method === "pix" ? "Vence em" : "Próxima cobrança"}
                  value={fmtDate(sub.current_period_end)}
                />
                <Info
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Último pagamento"
                  value={fmtDate(sub.last_payment_at)}
                />
                <Info
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  label="Termo aceito em"
                  value={fmtDate(sub.terms_accepted_at)}
                />
              </div>

              {sub.cancel_at_period_end && (
                <p className="mt-5 text-sm text-amber-700">
                  Sua assinatura será cancelada ao fim do período atual (
                  {fmtDate(sub.current_period_end)}).
                </p>
              )}

              {sub.plan?.features?.length ? (
                <div className="mt-6">
                  <p className="text-xs uppercase tracking-wider text-brown-soft mb-2">Inclui</p>
                  <ul className="space-y-1.5 text-sm text-brown">
                    {sub.plan.features.map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <CheckCircle2 className="h-4 w-4 text-bronze flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => navigate({ to: "/planos" })}
                variant="outline"
                className="border-bronze text-wine hover:bg-cream"
              >
                Trocar de plano
              </Button>
              <Link to="/meus-agendamentos">
                <Button className="bg-bronze text-white hover:bg-wine shadow-bronze">
                  Meus agendamentos
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream/60 border border-border p-3">
      <div className="flex items-center gap-2 text-brown-soft text-xs">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-wine font-semibold mt-1">{value}</p>
    </div>
  );
}
