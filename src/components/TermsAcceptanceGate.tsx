import { useEffect, useState } from "react";
import { FileText, ShieldCheck } from "lucide-react";
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
  const userId = user?.id;
  const [status, setStatus] = useState<TermsStatus | null>(null);
  const [signerName, setSignerName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verificationError, setVerificationError] = useState(false);
  const [checkAttempt, setCheckAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (authLoading || !userId) {
      setStatus(null);
      setVerificationError(false);
      return;
    }

    setStatus(null);
    setVerificationError(false);
    getTermsAcceptanceStatus()
      .then((result) => {
        if (active) setStatus(result as TermsStatus);
      })
      .catch(() => {
        if (active) {
          setVerificationError(true);
          toast.error("Não foi possível verificar os termos de uso.");
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, userId, checkAttempt]);

  if (userId && !authLoading && (verificationError || status === null)) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/75 p-4 backdrop-blur-sm">
        <section className="w-full max-w-md rounded-2xl border border-bronze/30 bg-white p-6 text-center shadow-2xl">
          <h2 className="font-display text-2xl font-bold text-wine">Verificando os termos</h2>
          <p className="mt-3 text-sm leading-6 text-brown-soft">
            {verificationError
              ? "Não foi possível confirmar se você já aceitou a versão atual. O acesso ficará bloqueado até a verificação funcionar."
              : "Aguarde enquanto confirmamos o aceite dos termos da plataforma."}
          </p>
          {verificationError && (
            <Button
              type="button"
              onClick={() => setCheckAttempt((attempt) => attempt + 1)}
              className="mt-5 w-full bg-wine text-white hover:bg-bronze"
            >
              Tentar novamente
            </Button>
          )}
        </section>
      </div>
    );
  }

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
            <FileText className="h-6 w-6" />
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
        <div className="mt-4 max-h-52 overflow-y-auto rounded-xl border border-border bg-background p-4 text-sm leading-6 text-brown">
          <h3 className="font-bold text-wine">Termos aplicáveis ao seu perfil</h3>
          {status.roles.map((role) => (
            <div key={role} className="mt-3">
              <p className="font-semibold">{roleLabel(role)}</p>
              <p className="mt-1">
                {role === "aluno"
                  ? "Mantenha seus dados atualizados, utilize os recursos para fins educacionais e acompanhe a regularidade da assinatura para acessar as aulas e materiais do plano. Compareça às aulas e comunique impedimentos com antecedência quando possível."
                  : "Mantenha perfil, disponibilidade e dados verdadeiros e atualizados. Conduza aulas e comunicações de forma profissional e respeitosa, e acompanhe os registros da carteira e as regras operacionais da plataforma."}
              </p>
            </div>
          ))}
          <p className="mt-3">A plataforma conecta alunos e professores para aulas, materiais, agenda e acompanhamento pedagógico. Proteja suas credenciais e utilize mensagens e conteúdos no contexto educacional. Versão {"2026.10.03"}.</p>
          <a href="/termos-de-uso" target="_blank" rel="noreferrer" className="mt-3 inline-flex font-semibold text-bronze hover:text-wine">
            Consultar os termos completos
          </a>
        </div>
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
