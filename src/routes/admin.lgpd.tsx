import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Download,
  FileText,
  History,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  UserX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getLgpdAdminDashboard,
  runLgpdRetentionCleanup,
  runPrivacyRequestAdminAction,
  updatePrivacyRequestAdmin,
} from "@/functions/privacy.functions";

type RequestStatus = "open" | "in_review" | "waiting_user" | "completed" | "rejected" | "cancelled";

type PrivacyRequest = {
  id: string;
  protocol: string;
  request_type: string;
  status: RequestStatus | string;
  description: string;
  admin_response?: string | null;
  due_at: string;
  user_id?: string | null;
  created_at: string;
};

type RetentionRule = {
  id: string;
  data_category: string;
  retention_period: string;
  action: string;
};

type AuditLog = {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
};

type LgpdDashboard = {
  privacyRequests: PrivacyRequest[];
  retentionRules: RetentionRule[];
  auditLogs: AuditLog[];
};

const statusLabels: Record<RequestStatus, string> = {
  open: "Aberta",
  in_review: "Em análise",
  waiting_user: "Aguardando usuário",
  completed: "Concluída",
  rejected: "Recusada",
  cancelled: "Cancelada",
};

export const Route = createFileRoute("/admin/lgpd")({
  head: () => ({ meta: [{ title: "LGPD — Diretoria GWLanguageFlow" }] }),
  component: () => (
    <RequireAuth allow={["dev"]}>
      <LgpdAdminPage />
    </RequireAuth>
  ),
});

function LgpdAdminPage() {
  const [dashboard, setDashboard] = useState<LgpdDashboard | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [response, setResponse] = useState("");
  const [status, setStatus] = useState<RequestStatus>("in_review");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionOutput, setActionOutput] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const data = await getLgpdAdminDashboard();
      const loaded = data as unknown as LgpdDashboard;
      setDashboard(loaded);
      const first = loaded.privacyRequests?.[0];
      setSelectedId((current) => current || first?.id || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar o painel LGPD.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const requests = useMemo(() => dashboard?.privacyRequests ?? [], [dashboard?.privacyRequests]);
  const selected = useMemo(
    () => requests.find((item) => item.id === selectedId) ?? requests[0] ?? null,
    [requests, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setStatus(selected.status as RequestStatus);
    setResponse(selected.admin_response ?? "");
  }, [selected]);

  const stats = useMemo(() => {
    const open = requests.filter((item) => item.status === "open").length;
    const review = requests.filter((item) => item.status === "in_review").length;
    const completed = requests.filter((item) => item.status === "completed").length;
    return [
      ["Solicitações", requests.length, FileText],
      ["Abertas", open, ShieldAlert],
      ["Em análise", review, RefreshCcw],
      ["Concluídas", completed, CheckCircle2],
    ] as Array<[string, number, LucideIcon]>;
  }, [requests]);

  const saveResponse = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await updatePrivacyRequestAdmin({
        data: {
          requestId: selected.id,
          status,
          adminResponse: response || "Solicitação analisada pela Diretoria.",
        },
      });
      toast.success("Solicitação LGPD atualizada.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar a resposta.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (action: "export" | "anonymize") => {
    if (!selected) return;
    setSaving(true);
    try {
      const result = await runPrivacyRequestAdminAction({
        data: { requestId: selected.id, action, reason: selected.description },
      });
      setActionOutput(JSON.stringify(result, null, 2));
      toast.success(action === "export" ? "Exportação gerada." : "Anonimização concluída.");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "A ação LGPD falhou.");
    } finally {
      setSaving(false);
    }
  };

  const runRetention = async () => {
    setSaving(true);
    try {
      const result = await runLgpdRetentionCleanup({ data: {} });
      setActionOutput(JSON.stringify(result, null, 2));
      toast.success("Retenção aplicada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retenção não foi executada.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="gw-app-shell min-h-screen">
      <SiteHeader />
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 rounded-xl border border-wine/10 bg-white p-5 shadow-soft md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-bronze">
                Diretoria • governança de dados
              </p>
              <h1 className="mt-2 font-display text-3xl font-bold text-wine md:text-5xl">
                Painel LGPD
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-brown-soft">
                Solicitações de titulares, respostas administrativas, exportação, anonimização,
                políticas, logs e retenção.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline" className="rounded-lg">
                <Link to="/admin">Voltar à Diretoria</Link>
              </Button>
              <Button onClick={load} variant="outline" disabled={loading} className="rounded-lg">
                <RefreshCcw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([label, value, Icon]) => (
            <div key={label} className="rounded-xl border border-border bg-white p-4 shadow-soft">
              <Icon className="mb-2 h-5 w-5 text-bronze" />
              <p className="font-display text-2xl font-bold text-wine">{value}</p>
              <p className="text-xs text-brown-soft">{label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-white p-8 text-center text-brown-soft">
            Carregando painel LGPD...
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <section className="rounded-xl border border-border bg-white p-4 shadow-soft">
              <SectionTitle icon={FileText} title="Solicitações" />
              <div className="mt-4 max-h-[720px] space-y-2 overflow-y-auto pr-1">
                {requests.length === 0 ? (
                  <Empty text="Nenhuma solicitação LGPD registrada." />
                ) : (
                  requests.map((request) => (
                    <button
                      type="button"
                      key={request.id}
                      onClick={() => setSelectedId(request.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        selected?.id === request.id
                          ? "border-wine bg-cream"
                          : "border-border bg-white hover:border-bronze"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-wine">{request.protocol}</p>
                          <p className="mt-1 text-xs text-brown-soft">
                            {request.request_type} •{" "}
                            {new Date(request.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <Badge variant={request.status === "completed" ? "default" : "outline"}>
                          {statusLabels[request.status as RequestStatus] ?? request.status}
                        </Badge>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-brown">
                        {request.description}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-xl border border-border bg-white p-4 shadow-soft">
                <SectionTitle icon={ShieldCheck} title="Tratamento da solicitação" />
                {!selected ? (
                  <Empty text="Selecione uma solicitação." />
                ) : (
                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Info label="Protocolo" value={selected.protocol} />
                      <Info label="Tipo" value={selected.request_type} />
                      <Info
                        label="Prazo"
                        value={new Date(selected.due_at).toLocaleDateString("pt-BR")}
                      />
                    </div>
                    <div className="rounded-xl border border-border bg-cream/60 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-brown-soft">
                        Descrição do titular
                      </p>
                      <p className="mt-2 text-sm leading-6 text-brown">{selected.description}</p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <select
                          id="status"
                          value={status}
                          onChange={(event) => setStatus(event.target.value as RequestStatus)}
                          className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {Object.entries(statusLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="response">Resposta administrativa</Label>
                        <Textarea
                          id="response"
                          value={response}
                          onChange={(event) => setResponse(event.target.value)}
                          className="min-h-28"
                          placeholder="Registre a resposta, fundamento e providência adotada."
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        onClick={saveResponse}
                        disabled={saving}
                        className="rounded-lg bg-wine text-white"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Salvar resposta
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => runAction("export")}
                        disabled={saving || !selected.user_id}
                        className="rounded-lg"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Exportar dados
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => runAction("anonymize")}
                        disabled={saving || !selected.user_id}
                        className="rounded-lg border-wine/25 text-wine"
                      >
                        <UserX className="mr-2 h-4 w-4" />
                        Anonimizar usuário
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel icon={Archive} title="Retenção">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      onClick={runRetention}
                      disabled={saving}
                      className="rounded-lg bg-wine text-white"
                    >
                      Aplicar retenção
                    </Button>
                  </div>
                  <div className="mt-4 space-y-2">
                    {(dashboard?.retentionRules ?? []).map((rule) => (
                      <div
                        key={rule.id}
                        className="rounded-lg border border-border bg-cream/60 p-3"
                      >
                        <p className="text-sm font-bold text-wine">{rule.data_category}</p>
                        <p className="mt-1 text-xs leading-5 text-brown-soft">
                          {rule.retention_period} • {rule.action}
                        </p>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel icon={History} title="Logs recentes">
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {(dashboard?.auditLogs ?? []).slice(0, 20).map((log) => (
                      <div key={log.id} className="rounded-lg border border-border bg-cream/60 p-3">
                        <p className="text-sm font-bold text-wine">{log.action}</p>
                        <p className="mt-1 text-xs text-brown-soft">
                          {log.entity_type} • {new Date(log.created_at).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              {actionOutput && (
                <details className="rounded-xl border border-border bg-white p-4 shadow-soft" open>
                  <summary className="cursor-pointer font-bold text-wine">
                    Resultado técnico
                  </summary>
                  <pre className="mt-3 max-h-[360px] overflow-auto rounded-lg bg-cream p-3 text-xs text-brown">
                    {actionOutput}
                  </pre>
                </details>
              )}
            </section>
          </div>
        )}
      </main>
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

function Panel({
  icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-white p-4 shadow-soft">
      <SectionTitle icon={icon} title={title} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-cream/60 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-brown-soft">{label}</p>
      <p className="mt-1 text-sm font-semibold text-brown">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-brown-soft">
      {text}
    </p>
  );
}
