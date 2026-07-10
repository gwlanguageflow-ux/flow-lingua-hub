import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  QrCode,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { createSubscriptionCheckout } from "@/functions/validapay-checkout.functions";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getProfileAvatarUrl } from "@/lib/profile-media";
import {
  calculateSubscriptionPackage,
  SUBSCRIPTION_PACKAGES,
  type PackageBillingMode,
  type PackageType,
} from "@/lib/subscription-packages";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos de Assinatura - GWLanguageFlow" },
      {
        name: "description",
        content:
          "Escolha seu plano na GWLanguageFlow: aulas, materiais, atividades e acompanhamento pedagogico.",
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
  kind?: "platform" | "custom";
  customPlanId?: string;
}

interface SelectedTeacher {
  id: string;
  full_name: string;
  avatar_url: string | null;
  email: string | null;
}

type TeacherPricingMode = "platform" | "custom" | null;

type DiscountCoupon = Pick<
  Tables<"discount_coupons">,
  "id" | "code" | "discount_percent" | "scope" | "teacher_id"
>;

const comparisonRows = [
  ["Aulas online", "Sim, com professor especialista"],
  ["Materiais semanais", "PDFs, links e atividades no painel"],
  ["Acompanhamento", "Direcao pedagogica e historico do aluno"],
  ["Assinatura", "Checkout ValidaPay com cartao de credito ou Pix Automatico"],
];

const planDisplayOrder: Record<string, number> = {
  advanced: 1,
  essencial: 2,
  essential: 2,
  conversation: 3,
};

function orderPlansForDisplay(plans: Plan[]) {
  return [...plans].sort((a, b) => {
    const aOrder = planDisplayOrder[a.slug] ?? a.sort_order ?? 99;
    const bOrder = planDisplayOrder[b.slug] ?? b.sort_order ?? 99;

    if (aOrder !== bOrder) return aOrder - bOrder;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

function PlansPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacher, setTeacher] = useState<SelectedTeacher | null>(null);
  const [teacherPricingMode, setTeacherPricingMode] = useState<TeacherPricingMode>(null);
  const [teacherCoupon, setTeacherCoupon] = useState<DiscountCoupon | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [useTeacherCoupon, setUseTeacherCoupon] = useState(false);
  const [packageType, setPackageType] = useState<PackageType>("mensal");
  const [packageBillingMode, setPackageBillingMode] = useState<PackageBillingMode>("monthly");

  useEffect(() => {
    let cancelled = false;

    async function loadPlans() {
      const professor = new URLSearchParams(window.location.search).get("professor");
      setTeacherId(professor);

      const { data: platformRows } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      const platformPlans = orderPlansForDisplay(
        ((platformRows ?? []) as Plan[]).map((plan) => ({ ...plan, kind: "platform" })),
      );

      if (!professor) {
        if (!cancelled) {
          setTeacher(null);
          setTeacherPricingMode(null);
          setPlans(platformPlans);
        }
        return;
      }

      const [{ data: profile }, { data: teacherProfile }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, email")
          .eq("id", professor)
          .maybeSingle(),
        supabase
          .from("teacher_profiles")
          .select("id, use_custom_pricing")
          .eq("id", professor)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      setTeacher((profile as SelectedTeacher | null) ?? null);
      const mode: TeacherPricingMode = teacherProfile?.use_custom_pricing ? "custom" : "platform";
      setTeacherPricingMode(mode);

      if (mode === "custom") {
        const { data: customRows } = await supabase
          .from("teacher_custom_plans")
          .select("id, name, description, price, interval, sort_order")
          .eq("teacher_id", professor)
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        if (!cancelled) {
          setPlans(
            orderPlansForDisplay(
              (customRows ?? []).map((plan) => ({
                id: plan.id,
                slug: `custom-${plan.id}`,
                name: plan.name,
                description: plan.description,
                features: [plan.description],
                price: Number(plan.price),
                interval: plan.interval,
                installments: 1,
                sort_order: plan.sort_order ?? 1,
                kind: "custom" as const,
                customPlanId: plan.id,
              })),
            ),
          );
        }
      } else {
        setPlans(platformPlans);
      }

      const now = new Date().toISOString();
      const { data: couponData } = await supabase
        .from("discount_coupons")
        .select("id, code, discount_percent, scope, teacher_id")
        .eq("scope", "teacher")
        .eq("teacher_id", professor)
        .eq("active", true)
        .is("deleted_at", null)
        .lte("starts_at", now)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        const coupon = (couponData as DiscountCoupon | null) ?? null;
        setTeacherCoupon(coupon);
        setUseTeacherCoupon(Boolean(coupon));
      }
    }

    void loadPlans();

    return () => {
      cancelled = true;
    };
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
      toast.error("Voce precisa aceitar o Termo de Adesao e Contrato.");
      return;
    }

    setLoading(true);
    try {
      const res = await createSubscriptionCheckout({
        data: {
          planSlug: selected.kind === "custom" ? null : selected.slug,
          customPlanId: selected.kind === "custom" ? selected.customPlanId : null,
          teacherId,
          packageType,
          packageBillingMode,
          termsAccepted: true,
          couponCode:
            useTeacherCoupon && teacherCoupon
              ? teacherCoupon.code
              : couponCode.trim()
                ? couponCode.trim()
                : null,
        },
      });
      if ("url" in res && res.url) window.location.href = res.url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao abrir checkout ValidaPay");
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
                    {teacherPricingMode === "custom"
                      ? "Escolha o plano criado pelo professor."
                      : "Escolha a intensidade da sua evolucao."}
                  </h1>
                  <p className="mt-4 max-w-2xl leading-7 text-brown-soft">
                    {teacherPricingMode === "custom"
                      ? "Este professor trabalha com valores próprios. A assinatura continua registrada na plataforma, com checkout ValidaPay e liberação automática após pagamento."
                      : "Cada assinatura combina aula, material, atividade e acompanhamento. Voce escolhe o ritmo, a plataforma organiza o percurso."}
                  </p>
                </div>
                <div className="gw-ink-panel p-6 md:p-8">
                  <p className="font-display text-2xl font-bold text-white">Checkout ValidaPay</p>
                  <p className="mt-2 text-sm leading-6 text-white/66">
                    Professor vinculado, aceite registrado e pagamento em ambiente seguro com cartao
                    de credito ou Pix Automatico.
                  </p>
                  <div className="mt-5 grid gap-3">
                    <PlanSignal icon={ShieldCheck} label="Contrato e aceite registrados" dark />
                    <PlanSignal icon={CreditCard} label="Cartao de credito" dark />
                    <PlanSignal icon={QrCode} label="Pix Automatico" dark />
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-6 hidden max-w-4xl gap-3 md:grid md:grid-cols-3">
              <PlanSignal icon={ShieldCheck} label="Contrato e aceite registrados" />
              <PlanSignal icon={CreditCard} label="Cartao de credito" />
              <PlanSignal icon={QrCode} label="Pix Automatico" />
            </div>

            {teacher ? (
              <div className="mx-auto mt-6 flex max-w-xl items-center justify-center gap-3 rounded-xl border border-bronze/30 bg-white/86 px-4 py-3 text-sm font-semibold text-wine shadow-soft">
                {getProfileAvatarUrl(teacher) ? (
                  <img
                    src={getProfileAvatarUrl(teacher) ?? ""}
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
                  Planos em preparacao
                </h2>
                <p className="mt-2 text-brown-soft">
                  Os planos ativos serao exibidos aqui assim que estiverem disponiveis.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-4">
                <PlansVideoCard />
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onSelect={() => {
                      setSelected(plan);
                      setTerms(false);
                      setPackageType("mensal");
                      setCouponCode("");
                      setUseTeacherCoupon(Boolean(teacherCoupon));
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
                  A assinatura nao compra so horas de aula.
                </h2>
                <p className="mt-4 leading-7 text-brown">
                  Ela ativa uma rotina de estudo com entregaveis claros, historico e suporte para o
                  aluno nao ficar perdido entre uma aula e outra.
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
          teacherCoupon={teacherCoupon}
          couponCode={couponCode}
          setCouponCode={setCouponCode}
          useTeacherCoupon={useTeacherCoupon}
          setUseTeacherCoupon={setUseTeacherCoupon}
          packageType={packageType}
          setPackageType={(value) => {
            setPackageType(value);
            if (value === "mensal") setPackageBillingMode("monthly");
          }}
          packageBillingMode={packageBillingMode}
          setPackageBillingMode={setPackageBillingMode}
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

function PlansVideoCard() {
  return (
    <article className="gw-panel gw-lift order-first relative flex min-h-[520px] flex-col overflow-hidden rounded-xl p-5 lg:order-last">
      <div className="rounded-xl bg-wine p-5 text-white shadow-bronze">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-bronze-light">
          Apresentacao
        </p>
        <h3 className="mt-2 font-display text-2xl font-bold leading-tight">
          Veja os planos antes de escolher
        </h3>
        <p className="mt-3 text-sm leading-6 text-white/72">
          Uma explicacao rapida para entender qual plano combina melhor com o seu momento.
        </p>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-bronze/25 bg-black shadow-soft">
        <video
          className="aspect-video w-full bg-black object-contain"
          controls
          playsInline
          preload="metadata"
          poster="/videos/apresentacao-planos-poster.jpg"
        >
          <source src="/videos/apresentacao-planos.mp4" type="video/mp4" />
          Seu navegador nao suporta video HTML5.
        </video>
      </div>

      <div className="mt-auto pt-5">
        <div className="rounded-xl border border-bronze/25 bg-cream p-4 text-sm leading-6 text-brown">
          Assista com calma e depois escolha o plano com o professor selecionado.
        </div>
      </div>
    </article>
  );
}

function PlanSignal({
  icon: Icon,
  label,
  dark = false,
}: {
  icon: LucideIcon;
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
  const featured = plan.slug === "essencial" || plan.slug === "essential";
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
          <h3 className="font-display text-2xl font-bold text-wine">{canonicalPlanName(plan)}</h3>
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
            : `Cobranca ${plan.interval}`}
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
  teacherCoupon,
  couponCode,
  setCouponCode,
  useTeacherCoupon,
  setUseTeacherCoupon,
  packageType,
  setPackageType,
  packageBillingMode,
  setPackageBillingMode,
  terms,
  setTerms,
  loading,
  onClose,
  onCheckout,
}: {
  selected: Plan | null;
  teacherCoupon: DiscountCoupon | null;
  couponCode: string;
  setCouponCode: (value: string) => void;
  useTeacherCoupon: boolean;
  setUseTeacherCoupon: (value: boolean) => void;
  packageType: PackageType;
  setPackageType: (value: PackageType) => void;
  packageBillingMode: PackageBillingMode;
  setPackageBillingMode: (value: PackageBillingMode) => void;
  terms: boolean;
  setTerms: (terms: boolean) => void;
  loading: boolean;
  onClose: () => void;
  onCheckout: () => void;
}) {
  const appliedTeacherCoupon = useTeacherCoupon && teacherCoupon ? teacherCoupon : null;
  const discountPercent = appliedTeacherCoupon?.discount_percent ?? 0;
  const packagePricing = selected
    ? calculateSubscriptionPackage(selected.price, packageType, packageBillingMode)
    : null;
  const discountValue =
    packagePricing && discountPercent > 0
      ? (packagePricing.totalAmount * discountPercent) / 100
      : 0;
  const finalValue = packagePricing ? packagePricing.totalAmount - discountValue : 0;

  return (
    <Dialog open={!!selected} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto rounded-xl p-4 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-wine">
            Finalizar assinatura - {selected ? canonicalPlanName(selected) : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="font-semibold text-wine">Escolha o pacote</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {(Object.keys(SUBSCRIPTION_PACKAGES) as PackageType[]).map((type) => {
                const config = SUBSCRIPTION_PACKAGES[type];
                const active = packageType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setPackageType(type)}
                    className={`rounded-lg border p-3 text-left transition ${
                      active
                        ? "border-wine bg-wine text-white shadow-soft"
                        : "border-border bg-cream/60 text-brown hover:border-bronze"
                    }`}
                  >
                    <span className="block text-sm font-bold">{config.label}</span>
                    <span
                      className={`mt-1 block text-xs ${active ? "text-white/75" : "text-brown-soft"}`}
                    >
                      {config.discountRate > 0
                        ? `${Math.round(config.discountRate * 100)}% de desconto`
                        : "Valor mensal normal"}
                    </span>
                  </button>
                );
              })}
            </div>
            {packageType !== "mensal" && (
              <div className="mt-4 rounded-xl border border-bronze/30 bg-cream p-3">
                <p className="text-sm font-semibold text-wine">Como deseja pagar?</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setPackageBillingMode("monthly")}
                    className={`rounded-lg border p-3 text-left text-sm transition ${
                      packageBillingMode === "monthly"
                        ? "border-wine bg-white text-wine shadow-soft"
                        : "border-border bg-white/70 text-brown hover:border-bronze"
                    }`}
                  >
                    <span className="block font-bold">Parcela mensal</span>
                    <span className="mt-1 block text-xs text-brown-soft">
                      Compromisso do pacote, pagando mes a mes.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPackageBillingMode("upfront")}
                    className={`rounded-lg border p-3 text-left text-sm transition ${
                      packageBillingMode === "upfront"
                        ? "border-wine bg-white text-wine shadow-soft"
                        : "border-border bg-white/70 text-brown hover:border-bronze"
                    }`}
                  >
                    <span className="block font-bold">À vista</span>
                    <span className="mt-1 block text-xs text-brown-soft">
                      Pague o pacote completo em uma única cobrança.
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-bronze/30 bg-cream p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-wine">Resumo do checkout</p>
              <span className="rounded-lg bg-white px-2 py-1 text-xs font-semibold text-bronze">
                v1
              </span>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-brown-soft">Plano</dt>
                <dd className="text-right font-semibold text-wine">
                  {selected ? canonicalPlanName(selected) : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brown-soft">
                  {packageBillingMode === "upfront" ? "Valor-base do pacote" : "Valor-base mensal"}
                </dt>
                <dd className="font-semibold text-wine">
                  {packagePricing ? formatMoney(packagePricing.baseAmount) : ""}
                </dd>
              </div>
              {packagePricing && packagePricing.discountAmount > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-brown-soft">Desconto {packagePricing.label}</dt>
                  <dd className="font-semibold text-emerald-700">
                    -{formatMoney(packagePricing.discountAmount)}
                  </dd>
                </div>
              )}
              {appliedTeacherCoupon && (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-brown-soft">Cupom</dt>
                    <dd className="text-right font-semibold text-emerald-700">
                      {appliedTeacherCoupon.code} - {discountPercent}%
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-brown-soft">Desconto</dt>
                    <dd className="font-semibold text-emerald-700">
                      -{formatMoney(discountValue)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-bronze/20 pt-2">
                    <dt className="font-semibold text-wine">Total com desconto</dt>
                    <dd className="font-bold text-wine">{formatMoney(finalValue)}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-brown-soft">Pacote</dt>
                <dd className="text-right font-semibold text-wine">
                  {packagePricing?.label}
                  {packagePricing && packagePricing.months > 1
                    ? ` (${packagePricing.months} meses)`
                    : ""}
                </dd>
              </div>
              {packagePricing && packagePricing.months > 1 && packageBillingMode === "monthly" && (
                <div className="flex justify-between gap-4">
                  <dt className="text-brown-soft">Compromisso total</dt>
                  <dd className="text-right font-semibold text-wine">
                    {packagePricing.months} parcelas de {formatMoney(finalValue)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-brown-soft">Pagamento</dt>
                <dd className="text-right font-semibold text-wine">
                  {packageBillingMode === "upfront"
                    ? "Pagamento à vista por cartão ou Pix"
                    : "Parcela mensal por cartão ou Pix Automático"}
                </dd>
              </div>
              <div className="flex justify-between gap-4 border-t border-bronze/20 pt-2">
                <dt className="font-semibold text-wine">
                  {packageBillingMode === "upfront" ? "Total a pagar" : "Parcela de hoje"}
                </dt>
                <dd className="font-bold text-wine">{formatMoney(finalValue)}</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-2 border-t border-bronze/20 pt-3 text-xs leading-5 text-brown-soft">
              <p>Ao continuar, voce sera direcionado ao checkout seguro da ValidaPay.</p>
              <p>O acesso e a carteira do professor sao liberados apos confirmacao do pagamento.</p>
              <p>O acesso ao agendamento depende da assinatura ativa.</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cream text-bronze">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-wine">Adicionar cupom</p>
                <p className="mt-1 text-xs leading-5 text-brown-soft">
                  Se o professor tiver cupom ativo, ele aparece aqui automaticamente. Voce escolhe
                  se quer aplicar antes de pagar.
                </p>
              </div>
            </div>

            {teacherCoupon && (
              <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-bold text-emerald-800">
                      Cupom do professor: {teacherCoupon.code}
                    </p>
                    <p className="text-xs text-emerald-700">
                      {teacherCoupon.discount_percent}% de desconto neste checkout.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={useTeacherCoupon ? "default" : "outline"}
                    onClick={() => setUseTeacherCoupon(!useTeacherCoupon)}
                    className={
                      useTeacherCoupon
                        ? "bg-emerald-700 text-white hover:bg-emerald-800"
                        : "border-emerald-400 text-emerald-800 hover:bg-emerald-100"
                    }
                  >
                    {useTeacherCoupon ? "Cupom aplicado" : "Aplicar cupom"}
                  </Button>
                </div>
              </div>
            )}

            {(!teacherCoupon || !useTeacherCoupon) && (
              <div className="mt-4 grid gap-2">
                <Input
                  value={couponCode}
                  onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                  placeholder="Ex: ELO10"
                  className="uppercase"
                />
                <p className="text-xs text-brown-soft">
                  Cupons do professor usam 3 letras + 2 numeros. Cupons da diretoria usam 4 letras +
                  2 numeros.
                </p>
              </div>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-4 transition hover:border-bronze/50">
            <Checkbox checked={terms} onCheckedChange={(value) => setTerms(!!value)} />
            <span className="text-sm leading-6 text-brown">
              Li e concordo com os <strong className="text-wine">Termos de Uso</strong> e o{" "}
              <strong className="text-wine">Contrato de Prestacao de Servicos</strong> da
              GWLanguageFlow.
            </span>
          </label>

          {terms && (
            <p className="flex items-center gap-2 text-xs font-semibold text-bronze">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Aceite sera registrado em {new Date().toLocaleString("pt-BR")}
            </p>
          )}
        </div>

        <DialogFooter className="sticky -bottom-4 -mx-4 border-t border-border bg-background/95 p-4 shadow-[0_-16px_30px_rgba(43,20,15,0.08)] backdrop-blur sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <Button
            onClick={onCheckout}
            disabled={loading || !terms}
            className="h-11 w-full rounded-lg bg-bronze text-white shadow-bronze hover:bg-wine"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="mr-2 h-4 w-4" />
            )}
            Ir para pagamento
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

function canonicalPlanName(plan: Pick<Plan, "slug" | "name">) {
  if (plan.slug === "essencial" || plan.slug === "essential") return "essential";
  if (plan.slug === "advanced") return "advanced";
  if (plan.slug === "conversation") return "conversation";
  return plan.name;
}

function normalizePlanFeature(feature: string) {
  const corrections: Record<string, string> = {
    "Desafio da influÃªncia": "Desafio da fluencia",
    "Foco em aperfeiÃ§oamento de complicaÃ§Ãµes":
      "Foco em aperfeicoamento de pontos de dificuldade",
    "Foco em aperfeiÃ§oar complicaÃ§Ãµes": "Foco em aperfeicoamento de pontos de dificuldade",
  };

  return corrections[feature] ?? feature;
}
