import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type SubInfo = Pick<
  Tables<"student_subscriptions">,
  "status" | "payment_method" | "current_period_end"
> & {
  subscription_plans: { name: string } | null;
  teacher_custom_plans: { name: string } | null;
};

const dayMs = 24 * 60 * 60 * 1000;

function renewalState(sub: SubInfo | null) {
  if (!sub?.current_period_end) {
    return { isExpired: false, isDueSoon: false, daysLeft: null as number | null };
  }

  const periodEnd = new Date(sub.current_period_end);
  const diff = periodEnd.getTime() - Date.now();
  const daysLeft = Math.max(1, Math.ceil(diff / dayMs));

  return {
    isExpired: diff <= 0,
    isDueSoon: diff > 0 && daysLeft <= 5,
    daysLeft,
  };
}

export function SubscriptionStatusBanner() {
  const { user, roles } = useAuth();
  const [sub, setSub] = useState<SubInfo | null | undefined>(undefined);

  useEffect(() => {
    if (!user || !roles.includes("aluno")) return;
    supabase
      .from("student_subscriptions")
      .select(
        "status, payment_method, current_period_end, subscription_plans(name), teacher_custom_plans(name)",
      )
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSub((data as SubInfo | null) ?? null));
  }, [user, roles]);

  if (!user || !roles.includes("aluno") || sub === undefined) return null;

  const renewal = renewalState(sub);
  const isOverdue = sub?.status === "inadimplente" || renewal.isExpired;

  if (sub?.status === "ativa" && !renewal.isExpired) {
    return (
      <div className="mb-6 rounded-2xl border border-bronze/30 bg-bronze/10 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-bronze" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-wine">
              Assinatura ativa - {sub.subscription_plans?.name ?? sub.teacher_custom_plans?.name}
            </p>
            {sub.current_period_end && (
              <p className="text-xs text-brown-soft">
                {sub.payment_method === "pix" ? "Valida ate" : "Proxima cobranca em"}{" "}
                {new Date(sub.current_period_end).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>

        {renewal.isDueSoon && (
          <div className="mt-3 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 md:flex-row md:items-center">
            <Clock className="h-5 w-5 flex-shrink-0" />
            <p className="flex-1">
              Sua assinatura vence em {renewal.daysLeft} {renewal.daysLeft === 1 ? "dia" : "dias"}.
              No vencimento, renove em Minha assinatura para manter o agendamento liberado.
            </p>
            <Link to="/minha-assinatura">
              <Button size="sm" variant="outline" className="border-amber-300 text-wine">
                Ver assinatura
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`mb-6 flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center ${
        isOverdue ? "border-destructive/40 bg-destructive/10" : "border-bronze/30 bg-cream"
      }`}
    >
      <AlertCircle
        className={`h-5 w-5 flex-shrink-0 ${isOverdue ? "text-destructive" : "text-bronze"}`}
      />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-wine">
          {isOverdue ? "Assinatura vencida" : "Voce ainda nao tem assinatura ativa"}
        </p>
        <p className="mt-0.5 text-xs text-brown-soft">
          {isOverdue
            ? "Regularize o pagamento para voltar a agendar aulas."
            : "Assine um plano para liberar o agendamento de aulas."}
        </p>
      </div>
      <Link to={isOverdue ? "/minha-assinatura" : "/planos"}>
        <Button className="bg-bronze text-white hover:bg-wine">
          {isOverdue ? "Regularizar" : "Ver planos"}
        </Button>
      </Link>
    </div>
  );
}
