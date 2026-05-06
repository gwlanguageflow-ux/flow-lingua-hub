import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { CheckCircle2, CreditCard, QrCode, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createSubscriptionCheckout } from "@/server/stripe-checkout.functions";

export const Route = createFileRoute("/planos")({
  head: () => ({
    meta: [
      { title: "Planos de Assinatura — GWLanguageFlow" },
      { name: "description", content: "Escolha o plano ideal: Essencial, Advanced, Conversation ou Anual." },
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

function PlansPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [method, setMethod] = useState<"card" | "pix">("card");
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => setPlans((data ?? []) as Plan[]));
  }, []);

  const handleCheckout = async () => {
    if (!user) { navigate({ to: "/auth/login" }); return; }
    if (!selected) return;
    if (!terms) { toast.error("Você precisa aceitar o Termo de Adesão e Contrato."); return; }
    setLoading(true);
    try {
      const origin = window.location.origin;
      const res = await createSubscriptionCheckout({
        data: {
          planSlug: selected.slug,
          paymentMethod: method,
          termsAccepted: true,
          successUrl: `${origin}/meus-agendamentos?checkout=success`,
          cancelUrl: `${origin}/planos?checkout=cancel`,
        },
      });
      if (res.url) window.location.href = res.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao iniciar checkout");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-10">
          <p className="text-bronze text-xs uppercase tracking-widest font-medium">Planos</p>
          <h1 className="font-display text-4xl md:text-5xl text-wine font-bold mt-2">Escolha seu plano</h1>
          <p className="text-brown-soft mt-3 max-w-xl mx-auto">Acesso completo às aulas e materiais. Cancele quando quiser.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`relative bg-background rounded-3xl border p-6 flex flex-col shadow-soft transition ${
                p.slug === "advanced" ? "border-bronze ring-2 ring-bronze/30" : "border-border"
              }`}
            >
              {p.slug === "advanced" && (
                <span className="absolute -top-3 right-6 bg-bronze text-white text-xs px-3 py-1 rounded-full">Mais popular</span>
              )}
              <h3 className="font-display text-2xl text-wine font-bold">{p.name}</h3>
              <p className="text-sm text-brown-soft mt-1 min-h-[40px]">{p.description}</p>
              <div className="mt-4">
                <span className="text-3xl font-display font-bold text-wine">
                  {p.installments > 1 ? `${p.installments}x ` : ""}R$ {(p.installments > 1 ? p.price / p.installments : p.price).toFixed(2).replace(".", ",")}
                </span>
                <span className="text-xs text-brown-soft block mt-1">
                  {p.interval === "anual" ? `Total R$ ${p.price.toFixed(2).replace(".", ",")} / ano` : `Cobrança ${p.interval}`}
                </span>
              </div>
              <ul className="mt-5 space-y-2 flex-1">
                {p.features.map((f, i) => (
                  <li key={i} className="flex gap-2 text-sm text-brown">
                    <CheckCircle2 className="h-4 w-4 text-bronze flex-shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => { setSelected(p); setTerms(false); }}
                className="mt-6 bg-wine hover:bg-wine/90 text-white"
              >
                Assinar
              </Button>
            </div>
          ))}
        </div>

        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-wine font-display">Finalizar assinatura — {selected?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <div>
                <Label className="text-sm font-semibold text-wine">Forma de pagamento</Label>
                <RadioGroup value={method} onValueChange={(v) => setMethod(v as "card" | "pix")} className="mt-2 grid grid-cols-2 gap-2">
                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${method === "card" ? "border-bronze bg-cream" : "border-border"}`}>
                    <RadioGroupItem value="card" />
                    <CreditCard className="h-4 w-4 text-bronze" />
                    <span className="text-sm">Cartão</span>
                  </label>
                  <label className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer ${method === "pix" ? "border-bronze bg-cream" : "border-border"}`}>
                    <RadioGroupItem value="pix" />
                    <QrCode className="h-4 w-4 text-bronze" />
                    <span className="text-sm">PIX</span>
                  </label>
                </RadioGroup>
                <p className="text-[11px] text-brown-soft mt-2">
                  {method === "card"
                    ? "Cobrança recorrente automática no seu cartão."
                    : "PIX é pagamento único do período. Você precisará renovar manualmente ao final."}
                </p>
              </div>

              <div className="rounded-xl bg-cream p-4 max-h-44 overflow-y-auto text-xs text-brown space-y-2">
                <p className="font-semibold text-wine">Termo de Adesão e Contrato</p>
                <p>Ao assinar, você adere ao plano <strong>{selected?.name}</strong> da GWLanguageFlow nas condições descritas (cobrança {selected?.interval}, valor R$ {selected?.price.toFixed(2).replace(".", ",")}).</p>
                <p>Em caso de inadimplência, o acesso ao agendamento de aulas será suspenso até regularização. Você pode cancelar a qualquer momento; o acesso permanece até o fim do período pago.</p>
                <p>Os pagamentos são processados pela plataforma. Os professores são remunerados pela GWLanguageFlow conforme contrato próprio.</p>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={terms} onCheckedChange={(v) => setTerms(!!v)} className="mt-0.5" />
                <span className="text-sm text-brown">Li e aceito o Termo de Adesão e Contrato.</span>
              </label>
            </div>
            <DialogFooter>
              <Button onClick={handleCheckout} disabled={loading || !terms} className="w-full bg-bronze text-white hover:bg-wine shadow-bronze">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Pagar e ativar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
      <SiteFooter />
    </div>
  );
}
