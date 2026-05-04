import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { createTeacherOnboardingLink, refreshTeacherStripeStatus } from "@/server/stripe-connect.functions";
import { toast } from "sonner";

export function StripeConnectCard() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<{
    connected: boolean;
    chargesEnabled: boolean;
    onboardingComplete: boolean;
  } | null>(null);

  useEffect(() => {
    refreshTeacherStripeStatus()
      .then((s) => setStatus(s))
      .catch(() => setStatus({ connected: false, chargesEnabled: false, onboardingComplete: false }))
      .finally(() => setLoading(false));
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const origin = window.location.origin;
      const { url } = await createTeacherOnboardingLink({
        data: {
          returnUrl: `${origin}/dashboard?stripe=ok`,
          refreshUrl: `${origin}/dashboard?stripe=refresh`,
        },
      });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao iniciar onboarding");
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-cream rounded-2xl p-5 border border-border flex items-center gap-3">
        <Loader2 className="h-4 w-4 animate-spin text-bronze" />
        <p className="text-sm text-brown-soft">Verificando status de pagamentos...</p>
      </div>
    );
  }

  if (status?.chargesEnabled) {
    return (
      <div className="bg-cream rounded-2xl p-5 border border-border flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-bronze flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-wine">Pagamentos ativos</p>
          <p className="text-sm text-brown-soft mt-1">
            Você já pode receber pagamentos. 91% de cada aula cai direto na sua conta bancária.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream rounded-2xl p-5 border border-bronze/40 flex items-start gap-3">
      <AlertCircle className="h-5 w-5 text-bronze flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="font-semibold text-wine">
          {status?.connected ? "Complete seu cadastro de pagamentos" : "Configure pagamentos"}
        </p>
        <p className="text-sm text-brown-soft mt-1 mb-3">
          Para receber por suas aulas, conclua o cadastro Stripe (dados bancários e identidade).
        </p>
        <Button onClick={handleConnect} disabled={connecting} className="bg-wine hover:bg-wine/90 text-white">
          {connecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {status?.connected ? "Continuar cadastro" : "Conectar conta de pagamento"}
        </Button>
      </div>
    </div>
  );
}
