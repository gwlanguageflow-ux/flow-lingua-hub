import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  Loader2,
  QrCode,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  WalletCards,
} from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { createSubscriptionCheckout } from "@/functions/stripe-checkout.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos de Assinatura — GWLanguageFlow" },
      {
        name: "description",
        content:
          "Escolha seu plano na GWLanguageFlow: aulas, materiais, atividades e acompanhamento pedagógico.",
      },
    ],
  }),
  component: PlansPage,
});

interface Plan {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  features: string[];
  price: number;
  interval: "mensal" | "trimestral" | "anual";
  installments: number;
  sort_order: number;
}

interface SelectedTeacher {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

const comparisonRows = [
  ["Aulas online", "Sim, com professor especialista"],
  ["Materiais semanais", "PDFs, links e atividades no painel"],
  ["Acompanhamento", "Direção pedagógica e histórico do aluno"],
  ["Pagamento", "Cartão recorrente com checkout seguro"],
];

const STRIPE_PIX_ENABLED = import.meta.env.VITE_STRIPE_PIX_ENABLED === "true";

function PlansPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [method, setMethod] = useState<"card" | "pix">("card");
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<SelectedTeacher | null>(null);

  useEffect(() => {
    const professor = new URLSearchParams(window.location.search).get("professor");
    setTeacherId(professor);

    supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setPlans((data ?? []) as Plan[]));

    if (professor) {
      supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", professor)
        .maybeSingle()
        .then(({ data }) => setTeacher((data as SelectedTeacher | null) ?? null));
    }
  }, []);

  const handleCheckout = async () => {
    if (!user) {
      navigate({ to: "/auth/login" });
      return;
    }
    if (!selected) return;
    if (!teacherId) {
      toast.error("Escolha um professor antes de assinar.");
      navigate({ to: "/feed" });
      return;
    }
    if (!terms) {
      toast.error("Você precisa aceitar o Termo de Adesão e Contrato.");
      return;
    }

    setLoading(true);
    try {
      const origin = window.location.origin;
      const res = await createSubscriptionCheckout({
        data: {
          planSlug: selected.slug,
          teacherId,
          paymentMethod: STRIPE_PIX_ENABLED ? method : "card",
          termsAccepted: true,
          successUrl: `${origin}/meus-agendamentos?checkout=success&professor=${teacherId}`,
          cancelUrl: `${origin}/planos?checkout=cancel&professor=${teacherId}`,
        },
      });
      if ("url" in res && res.url) window.location.href = res.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar checkout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gw-app-shell min-h-screen">
      <SiteHeader />
      <main>
        <section className="border-b border-border py-10 md:py-14">
          <div className="container mx-auto px-4">
            <div className="gw-command-hero overflow-hidden rounded-xl">
              <div className="grid gap-px bg-border/70 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="bg-white/92 p-6 md:p-9">
                  <p className="gw-section-kicker">Planos GWLanguageFlow</p>
                  <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-wine md:text-5xl">
                    Escolha a intensidade da sua evolução.
                  </h1>
                  <p className="mt-4 max-w-2xl leading-7 text-brown-soft">
                    Cada assinatura combina aula, material, atividade e acompanhamento. Você escolhe
                    o ritmo, a plataforma organiza o percurso.
                  </p>
                </div>
                <div className="gw-ink-panel p-6 md:p-8">
                  <p className="font-display text-2xl font-bold text-white">Fluxo seguro</p>
                  <p className="mt-2 text-sm leading-6 text-white/66">
                    Professor vinculado, aceite registrado e pagamento processado em ambiente
                    controlado.
                  </p>
                  <div className="mt-5 grid gap-3">
                    <PlanSignal icon={ShieldCheck} label="Contrato e aceite registrados" dark />
                    <PlanSignal icon={WalletCards} label="Cartão recorrente seguro" dark />
                    <PlanSignal icon={BadgeCheck} label="Acesso completo ao painel" dark />
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-6 hidden max-w-4xl gap-3 md:grid md:grid-cols-3">
              <PlanSignal icon={ShieldCheck} label="Contrato e aceite registrados" />
              <PlanSignal icon={WalletCards} label="Cartão recorrente seguro" />
              <PlanSignal icon={BadgeCheck} label="Acesso completo ao painel" />
            </div>

            {teacher ? (
              <div className="mx-auto mt-6 flex max-w-xl items-center justify-center gap-3 rounded-xl border border-bronze/30 bg-white/86 px-4 py-3 text-sm font-semibold text-wine shadow-soft">
                {teacher.avatar_url ? (
                  <img
                    src={teacher.avatar_url}
                    alt={teacher.full_name}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream text-bronze">
                    <UserRound className="h-4 w-4" />
                  </span>
                )}
                Assinatura com {teacher.full_name}
              </div>
            ) : (
              <div className="mx-auto mt-6 max-w-xl rounded-xl border border-bronze/30 bg-white/86 px-4 py-3 text-center text-sm font-semibold text-brown shadow-soft">
                Escolha um professor no feed para vincular sua assinatura.
              </div>
            )}
          </div>
        </section>

        <section className="bg-white/70 py-12 md:py-16">
          <div className="container mx-auto px-4">
            {plans.length === 0 ? (
              <div className="gw-panel mx-auto max-w-2xl rounded-xl p-8 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-bronze" />
                <h2 className="mt-4 font-display text-2xl font-bold text-wine">
                  Planos em preparação
                </h2>
                <p className="mt-2 text-brown-soft">
                  Os planos ativos serão exibidos aqui assim que estiverem disponíveis.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-4">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onSelect={() => {
                      setSelected(plan);
                      setTerms(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="gw-paper border-y border-border py-14">
          <div className="container mx-auto px-4">
            <div className="grid gap-10 lg:grid-cols-[0.7fr_1fr] lg:items-start">
              <div>
                <p className="text-sm font-bold uppercase text-bronze">O que acompanha</p>
                <h2 className="mt-3 font-display text-4xl font-bold leading-tight text-wine">
                  A assinatura não compra só horas de aula.
                </h2>
                <p className="mt-4 leading-7 text-brown">
                  Ela ativa uma rotina de estudo com entregáveis claros, histórico e suporte para o
                  aluno não ficar perdido entre uma aula e outra.
                </p>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-white shadow-soft">
                {comparisonRows.map(([title, text]) => (
                  <div
                    key={title}
                    className="grid gap-3 border-b border-border p-5 last:border-b-0 md:grid-cols-[180px_1fr]"
                  >
                    <div className="flex items-center gap-2 font-semibold text-wine">
                      <CheckCircle2 className="h-4 w-4 text-bronze" />
                      {title}
                    </div>
                    <p className="text-brown-soft">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <CheckoutDialog
          selected={selected}
          method={method}
          setMethod={setMethod}
          terms={terms}
          setTerms={setTerms}
          loading={loading}
          onClose={() => setSelected(null)}
          onCheckout={handleCheckout}
        />
      </main>
      <SiteFooter />
    </div>
  );
}

function PlanSignal({
  icon: Icon,
  label,
  dark = false,
}: {
  icon: typeof ShieldCheck;
  label: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold shadow-soft ${
        dark ? "border-white/10 bg-white/8 text-white/82" : "border-border bg-white/78 text-brown"
      }`}
    >
      <Icon className="h-4 w-4 text-bronze" />
      {label}
    </div>
  );
}

function PlanCard({ plan, onSelect }: { plan: Plan; onSelect: () => void }) {
  const featured = plan.slug === "advanced";
  const priceLabel =
    plan.installments > 1
      ? `${plan.installments}x ${formatMoney(plan.price / plan.installments)}`
      : formatMoney(plan.price);

  return (
    <article
      className={`gw-panel gw-lift relative flex min-h-[520px] flex-col rounded-xl p-6 ${
        featured ? "border-bronze shadow-bronze" : ""
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-6 inline-flex items-center gap-2 rounded-lg bg-bronze px-3 py-1 text-xs font-bold uppercase text-white shadow-bronze">
          <Trophy className="h-3.5 w-3.5" />
          Mais escolhido
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-2xl font-bold text-wine">{plan.name}</h3>
          <p className="mt-2 min-h-[48px] text-sm leading-6 text-brown-soft">{plan.description}</p>
        </div>
        {featured ? (
          <Trophy className="mt-1 h-6 w-6 flex-shrink-0 text-bronze" />
        ) : (
          <Sparkles className="mt-1 h-6 w-6 flex-shrink-0 text-bronze" />
        )}
      </div>

      <div className="my-6 h-px w-full bg-border" />

      <div>
        <p className="font-display text-4xl font-bold text-wine">{priceLabel}</p>
        <p className="mt-1 text-sm text-brown-soft">
          {plan.interval === "anual"
            ? `Total ${formatMoney(plan.price)} por ano`
            : `Cobrança ${plan.interval}`}
        </p>
      </div>

      <ul className="mt-6 flex-1 space-y-3">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2 text-sm leading-6 text-brown">
            <CheckCircle2 className="mt-1 h-4 w-4 flex-shrink-0 text-bronze" />
            <span>{normalizePlanFeature(feature)}</span>
          </li>
        ))}
      </ul>

      <Button
        onClick={onSelect}
        className={`gw-spark-button mt-7 h-11 rounded-lg text-white ${
          featured ? "bg-bronze hover:bg-wine" : "bg-wine hover:bg-wine-deep"
        }`}
      >
        Assinar plano
      </Button>
    </article>
  );
}

function CheckoutDialog({
  selected,
  method,
  setMethod,
  terms,
  setTerms,
  loading,
  onClose,
  onCheckout,
}: {
  selected: Plan | null;
  method: "card" | "pix";
  setMethod: (method: "card" | "pix") => void;
  terms: boolean;
  setTerms: (terms: boolean) => void;
  loading: boolean;
  onClose: () => void;
  onCheckout: () => void;
}) {
  const effectiveMethod = STRIPE_PIX_ENABLED ? method : "card";

  return (
    <Dialog open={!!selected} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-wine">
            Finalizar assinatura — {selected?.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div>
            <Label className="text-sm font-semibold text-wine">Forma de pagamento</Label>
            <RadioGroup
              value={method}
              onValueChange={(value) => setMethod(value as "card" | "pix")}
              className={`mt-3 grid gap-3 ${STRIPE_PIX_ENABLED ? "grid-cols-2" : "grid-cols-1"}`}
            >
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-2xl border p-4 transition ${
                  method === "card" ? "border-bronze bg-cream" : "border-border bg-white"
                }`}
              >
                <RadioGroupItem value="card" />
                <CreditCard className="h-4 w-4 text-bronze" />
                <span className="text-sm font-semibold">Cartão</span>
              </label>
              {STRIPE_PIX_ENABLED ? (
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded-2xl border p-4 transition ${
                    method === "pix" ? "border-bronze bg-cream" : "border-border bg-white"
                  }`}
                >
                  <RadioGroupItem value="pix" />
                  <QrCode className="h-4 w-4 text-bronze" />
                  <span className="text-sm font-semibold">PIX</span>
                </label>
              ) : null}
            </RadioGroup>
            <p className="mt-2 text-xs leading-5 text-brown-soft">
              {effectiveMethod === "card"
                ? "Cobrança recorrente automática no cartão."
                : "Pagamento por PIX avulso. O acesso será liberado até o fim do período contratado e você será avisado antes da renovação."}
            </p>
          </div>

          <div className="rounded-xl border border-bronze/30 bg-cream p-4">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-wine">Resumo do contrato</p>
              <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-bronze">
                v1
              </span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-brown-soft">Plano</dt>
                <dd className="text-right font-semibold text-wine">{selected?.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brown-soft">Valor</dt>
                <dd className="font-semibold text-wine">
                  {selected ? formatMoney(selected.price) : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brown-soft">Cobrança</dt>
                <dd className="font-semibold capitalize text-wine">{selected?.interval}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brown-soft">Pagamento</dt>
                <dd className="font-semibold text-wine">
                  {effectiveMethod === "card" ? "Cartão recorrente" : "PIX manual"}
                </dd>
              </div>
            </dl>
            <div className="mt-4 max-h-28 space-y-2 overflow-y-auto border-t border-bronze/20 pt-3 text-xs leading-5 text-brown-soft">
              <p>O acesso ao agendamento depende da assinatura ativa.</p>
              <p>Cancelamento permitido; acesso mantido até o fim do período pago.</p>
              <p>Pagamentos são processados pela GWLanguageFlow em ambiente seguro.</p>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4 transition hover:border-bronze/50">
            <Checkbox checked={terms} onCheckedChange={(value) => setTerms(!!value)} />
            <span className="text-sm leading-6 text-brown">
              Li e concordo com os <strong className="text-wine">Termos de Uso</strong> e o{" "}
              <strong className="text-wine">Contrato de Prestação de Serviços</strong> da
              GWLanguageFlow.
            </span>
          </label>

          {terms && (
            <p className="flex items-center gap-2 text-xs font-semibold text-bronze">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Aceite será registrado em {new Date().toLocaleString("pt-BR")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={onCheckout}
            disabled={loading || !terms}
            className="h-11 w-full rounded-lg bg-bronze text-white shadow-bronze hover:bg-wine"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Pagar e ativar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizePlanFeature(feature: string) {
  const corrections: Record<string, string> = {
    "Desafio da influência": "Desafio da fluência",
    "Foco em aperfeiçoamento de complicações": "Foco em aperfeiçoamento de pontos de dificuldade",
    "Foco em aperfeiçoar complicações": "Foco em aperfeiçoamento de pontos de dificuldade",
  };

  return corrections[feature] ?? feature;
}
