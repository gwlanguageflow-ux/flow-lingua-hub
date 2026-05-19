import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  getPrivacyCenterData,
  revokeUserConsent,
  submitPrivacyRequest,
} from "@/functions/privacy.functions";

type RequestType =
  | "access"
  | "export"
  | "correction"
  | "deletion"
  | "anonymization"
  | "consent_revocation"
  | "portability"
  | "opposition"
  | "information"
  | "other";

type PrivacyRequestRecord = {
  id: string;
  protocol: string;
  request_type: RequestType | string;
  status: string;
  description: string;
  admin_response?: string | null;
  created_at: string;
};

type PrivacyData = {
  profile?: unknown;
  roles?: unknown[];
  subscriptions?: unknown[];
  bookingsAsStudent?: unknown[];
  bookingsAsTeacher?: unknown[];
  classMemberships?: unknown[];
  classGroups?: unknown[];
  directorMessages?: unknown[];
  teacherStudentMessages?: unknown[];
  consents?: unknown[];
  sessions?: unknown[];
  privacyRequests?: PrivacyRequestRecord[];
};

const requestTypes: Array<{ value: RequestType; label: string; description: string }> = [
  { value: "access", label: "Acesso aos dados", description: "Confirmar e visualizar dados." },
  { value: "export", label: "Exportação", description: "Receber uma cópia estruturada." },
  { value: "correction", label: "Correção", description: "Ajustar dado incorreto." },
  { value: "deletion", label: "Exclusão", description: "Solicitar eliminação quando aplicável." },
  { value: "anonymization", label: "Anonimização", description: "Remover identificação pessoal." },
  {
    value: "consent_revocation",
    label: "Revogar consentimento",
    description: "Cancelar consentimentos não essenciais.",
  },
  { value: "portability", label: "Portabilidade", description: "Solicitar dados portáveis." },
  { value: "opposition", label: "Oposição", description: "Contestar tratamento específico." },
  { value: "information", label: "Informações", description: "Tirar dúvidas sobre tratamento." },
  { value: "other", label: "Outro pedido", description: "Registrar outro direito LGPD." },
];

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Central de Privacidade — GWLanguageFlow" }] }),
  component: PrivacyCenterPage,
});

function PrivacyCenterPage() {
  const { user, loading } = useAuth();
  const userId = user?.id;
  const [data, setData] = useState<PrivacyData | null>(null);
  const [requestType, setRequestType] = useState<RequestType>("access");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoadingData(true);
    try {
      setData((await getPrivacyCenterData()) as unknown as PrivacyData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar seus dados.");
    } finally {
      setLoadingData(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const dataSummary = useMemo(() => {
    if (!data) return [];
    return [
      ["Perfil", data.profile ? 1 : 0],
      ["Papéis de acesso", data.roles?.length ?? 0],
      ["Assinaturas", data.subscriptions?.length ?? 0],
      ["Aulas como aluno", data.bookingsAsStudent?.length ?? 0],
      ["Aulas como professor", data.bookingsAsTeacher?.length ?? 0],
      ["Turmas", (data.classMemberships?.length ?? 0) + (data.classGroups?.length ?? 0)],
      [
        "Mensagens",
        (data.directorMessages?.length ?? 0) + (data.teacherStudentMessages?.length ?? 0),
      ],
      ["Consentimentos", data.consents?.length ?? 0],
      ["Sessões registradas", data.sessions?.length ?? 0],
    ];
  }, [data]);
  const privacyRequests = data?.privacyRequests ?? [];

  const submitRequest = async () => {
    setSubmitting(true);
    try {
      const response = await submitPrivacyRequest({
        data: {
          requestType,
          description:
            description.trim() ||
            `Solicitação de ${requestTypes.find((item) => item.value === requestType)?.label}.`,
        },
      });
      toast.success(`Solicitação registrada: ${response.request.protocol}`);
      setDescription("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível abrir a solicitação.");
    } finally {
      setSubmitting(false);
    }
  };

  const revokeConsent = async () => {
    setSubmitting(true);
    try {
      await revokeUserConsent();
      localStorage.removeItem("gwlf_cookie_consent_v2026_05_19");
      window.dispatchEvent(new CustomEvent("gwlf:cookie-consent-updated"));
      toast.success("Consentimentos não essenciais revogados.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível revogar o consentimento.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-bronze border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <PrivacyShell>
        <section className="mx-auto max-w-2xl rounded-xl border border-border bg-white p-6 text-center shadow-soft">
          <LockKeyhole className="mx-auto h-10 w-10 text-bronze" />
          <h1 className="mt-4 font-display text-3xl font-bold text-wine">Central de Privacidade</h1>
          <p className="mt-3 text-sm leading-6 text-brown-soft">
            Entre na sua conta para visualizar dados armazenados, revogar consentimentos e abrir
            solicitações LGPD com protocolo.
          </p>
          <Button asChild className="mt-5 rounded-lg bg-wine text-white">
            <Link to="/auth/login">Entrar na conta</Link>
          </Button>
        </section>
      </PrivacyShell>
    );
  }

  return (
    <PrivacyShell>
      <div className="mb-6 rounded-xl border border-wine/10 bg-white p-5 shadow-soft md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-bronze">
              LGPD • versão 2026.05.19
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold text-wine md:text-5xl">
              Central de Privacidade
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-brown-soft md:text-base">
              Veja seus dados, abra solicitações, revogue consentimentos e acompanhe protocolos.
            </p>
          </div>
          <Button onClick={load} variant="outline" disabled={loadingData} className="rounded-lg">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-4 shadow-soft">
            <SectionTitle icon={Archive} title="Dados armazenados" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {dataSummary.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-border bg-cream/60 p-3">
                  <p className="text-xs font-semibold text-brown-soft">{label}</p>
                  <p className="mt-1 font-display text-2xl font-bold text-wine">{value}</p>
                </div>
              ))}
            </div>
            <details className="mt-4 rounded-xl border border-border bg-background p-3">
              <summary className="cursor-pointer text-sm font-bold text-wine">
                Ver exportação técnica em JSON
              </summary>
              <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg bg-white p-3 text-xs text-brown">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 shadow-soft">
            <SectionTitle icon={ClipboardList} title="Protocolos LGPD" />
            <div className="mt-4 space-y-3">
              {privacyRequests.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-brown-soft">
                  Nenhuma solicitação registrada ainda.
                </p>
              ) : (
                privacyRequests.map((request) => (
                  <article
                    key={request.id}
                    className="rounded-xl border border-border bg-cream/60 p-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-bold text-wine">{request.protocol}</p>
                        <p className="mt-1 text-xs text-brown-soft">
                          {requestTypeLabel(request.request_type)} • {statusLabel(request.status)}
                        </p>
                      </div>
                      <p className="text-xs text-brown-soft">
                        {new Date(request.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-brown">{request.description}</p>
                    {request.admin_response && (
                      <p className="mt-2 rounded-lg bg-white p-3 text-sm leading-6 text-brown">
                        {request.admin_response}
                      </p>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-4 shadow-soft">
            <SectionTitle icon={FileText} title="Abrir solicitação" />
            <div className="mt-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="request-type">Tipo</Label>
                <select
                  id="request-type"
                  value={requestType}
                  onChange={(event) => setRequestType(event.target.value as RequestType)}
                  className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {requestTypes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-brown-soft">
                  {requestTypes.find((item) => item.value === requestType)?.description}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Descreva o que você precisa que a Diretoria avalie."
                  className="min-h-32"
                />
              </div>
              <Button
                type="button"
                onClick={submitRequest}
                disabled={submitting}
                className="w-full rounded-lg bg-wine text-white"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Registrar solicitação
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 shadow-soft">
            <SectionTitle icon={ShieldCheck} title="Consentimentos" />
            <p className="mt-2 text-sm leading-6 text-brown-soft">
              Revogar remove permissões não essenciais. Cookies necessários continuam ativos para
              login, segurança e funcionamento.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={revokeConsent}
              disabled={submitting}
              className="mt-4 w-full rounded-lg"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Revogar consentimentos
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-white p-4 shadow-soft">
            <SectionTitle icon={Download} title="Políticas" />
            <div className="mt-3 grid gap-2 text-sm font-semibold">
              <a href="/politica-de-privacidade" className="text-bronze hover:text-wine">
                Política de Privacidade
              </a>
              <a href="/politica-de-cookies" className="text-bronze hover:text-wine">
                Política de Cookies
              </a>
              <a href="/termos-de-uso" className="text-bronze hover:text-wine">
                Termos de Uso
              </a>
              <a href="/politica-de-retencao" className="text-bronze hover:text-wine">
                Política de Retenção
              </a>
            </div>
          </div>
        </aside>
      </div>
    </PrivacyShell>
  );
}

function PrivacyShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-wine/10 bg-white/90 backdrop-blur">
        <div className="container mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Logo />
          <Button asChild variant="outline" className="rounded-lg">
            <Link to="/">Ir ao início</Link>
          </Button>
        </div>
      </header>
      <main className="container mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-bronze" />
      <h2 className="font-display text-xl font-bold text-wine">{title}</h2>
    </div>
  );
}

function requestTypeLabel(value: string) {
  return requestTypes.find((item) => item.value === value)?.label ?? value;
}

function statusLabel(value: string) {
  const labels: Record<string, string> = {
    open: "Aberta",
    in_review: "Em análise",
    waiting_user: "Aguardando usuário",
    completed: "Concluída",
    rejected: "Recusada",
    cancelled: "Cancelada",
  };
  return labels[value] ?? value;
}
