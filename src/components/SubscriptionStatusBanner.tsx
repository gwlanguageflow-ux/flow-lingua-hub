import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface SubInfo {
  status: "pendente" | "ativa" | "inadimplente" | "cancelada" | "expirada";
  current_period_end: string | null;
  subscription_plans: { name: string } | null;
}

/**
 * Banner de status de assinatura para alunos.
 * Mostra apenas se o aluno NÃO tem assinatura ativa, ou está inadimplente.
 */
export function SubscriptionStatusBanner() {
  const { user, roles } = useAuth();
  const [sub, setSub] = useState<SubInfo | null | undefined>(undefined);

  useEffect(() => {
    if (!user || !roles.includes("aluno")) return;
    supabase
      .from("student_subscriptions")
      .select("status, current_period_end, subscription_plans(name)")
      .eq("student_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSub((data as any) ?? null));
  }, [user, roles]);

  if (!user || !roles.includes("aluno") || sub === undefined) return null;

  if (sub?.status === "ativa") {
    return (
      <div className="bg-bronze/10 border border-bronze/30 rounded-2xl p-4 flex items-center gap-3 mb-6">
        <CheckCircle2 className="h-5 w-5 text-bronze flex-shrink-0" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-wine">Assinatura ativa — {sub.subscription_plans?.name}</p>
          {sub.current_period_end && (
            <p className="text-brown-soft text-xs">
              Válida até {new Date(sub.current_period_end).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      </div>
    );
  }

  const isOverdue = sub?.status === "inadimplente";
  return (
    <div className={`rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3 mb-6 border ${
      isOverdue ? "bg-destructive/10 border-destructive/40" : "bg-cream border-bronze/30"
    }`}>
      <AlertCircle className={`h-5 w-5 flex-shrink-0 ${isOverdue ? "text-destructive" : "text-bronze"}`} />
      <div className="flex-1 text-sm">
        <p className="font-semibold text-wine">
          {isOverdue ? "Assinatura inadimplente" : "Você ainda não tem assinatura ativa"}
        </p>
        <p className="text-brown-soft text-xs mt-0.5">
          {isOverdue
            ? "Regularize o pagamento para voltar a agendar aulas."
            : "Assine um plano para liberar o agendamento de aulas."}
        </p>
      </div>
      <Link to="/planos">
        <Button className="bg-bronze text-white hover:bg-wine">
          {isOverdue ? "Regularizar" : "Ver planos"}
        </Button>
      </Link>
    </div>
  );
}
