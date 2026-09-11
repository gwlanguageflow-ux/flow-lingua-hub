import { useEffect, useState } from "react";
import { FileSignature, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { acceptCurrentTerms, getTermsAcceptanceStatus } from "@/functions/terms.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TermsStatus = { required: boolean; roles: Array<"professor" | "aluno">; fullName: string };

const roleLabel = (role: "professor" | "aluno") => (role === "professor" ? "Professor" : "Aluno");

export function TermsAcceptanceGate() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<TermsStatus | null>(null);
  const [signerName, setSignerName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (authLoading || !user) {
      setStatus(null);
      return;
    }

    getTermsAcceptanceStatus()
      .then((result) => {
        if (active) setStatus(result as TermsStatus);
      })
      .catch(() => {
        if (active) toast.error("Não foi possível verificar os termos de uso.");
      });

    return () => {
      active = false;
    };
  }, [authLoading, user?.id]);

  if (!status?.required) return null;

  const accept = async () => {
    if (!confirmed) return;
    setSaving(true);
    try {
      await acceptCurrentTerms({ data: { signerName } });
      setStatus((current) => (current ? { ...current, required: false, roles: [] } : current));
      toast.success("Termos aceitos e assinatura registrada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar o aceite.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/75 p-4 backdrop-blur-sm">
      <section className="w-full max-w-xl rounded-2xl border border-bronze/30 bg-white p-6 shadow-2xl md:p-8">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bronze/15 text-bronze">
            <FileSignature className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-bronze">
              Atualização obrigatória
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold text-wine">Aceite dos termos</h2>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-brown">
          Para continuar usando a plataforma, leia e aceite os Termos de Uso aplicáveis ao seu
          perfil: {status.roles.map(roleLabel).join(" e ")}.
        </p>
        <a
          href="/termos-de-uso"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex font-semibold text-bronze hover:text-wine"
        >
          Ler os Termos de Uso completos
        </a>
        <div className="mt-5 rounded-xl border border-border bg-cream p-4 text-sm text-brown">
          <ShieldCheck className="mr-2 inline h-4 w-4 text-bronze" />
          Sua assinatura eletrônica registra seu nome, perfil, versão dos termos e data/hora do
          aceite.
        </div>
        <div className="mt-5 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="terms-signer-name">Assine com seu nome completo</Label>
            <Input
              id="terms-signer-name"
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
              placeholder={status.fullName}
              autoComplete="name"
            />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm text-brown">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-4 w-4 accent-wine"
            />
            Li e concordo com os Termos de Uso indicados acima e reconheço esta assinatura como meu
            aceite eletrônico.
          </label>
          <Button
            type="button"
            disabled={!confirmed || !signerName.trim() || saving}
            onClick={accept}
            className="w-full bg-wine text-white hover:bg-bronze"
          >
            {saving ? "Registrando..." : "Aceitar e continuar"}
          </Button>
        </div>
      </section>
    </div>
  );
}
