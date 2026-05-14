import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  BookOpen,
  FolderOpen,
  Calendar,
  Clock,
  BadgeCheck,
  Wallet,
  Banknote,
  History,
  Send,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AvailabilityManager } from "@/components/AvailabilityManager";
import { MeetingLinkEditor } from "@/components/MeetingLinkEditor";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — GWLanguageFlow" }] }),
  component: () => (
    <RequireAuth allow={["professor", "dev"]}>
      <DashboardPage />
    </RequireAuth>
  ),
});

type Booking = Tables<"bookings">;
type StudentProfile = Pick<Tables<"profiles">, "id" | "full_name" | "avatar_url">;
type WalletTransaction = Tables<"teacher_wallet_transactions">;
type WithdrawalRequest = Tables<"teacher_withdrawal_requests">;

type WalletSummary = {
  available_balance: number;
  total_received: number;
  total_withdrawn: number;
  pending_withdrawals: number;
};

const emptyWalletSummary: WalletSummary = {
  available_balance: 0,
  total_received: 0,
  total_withdrawn: 0,
  pending_withdrawals: 0,
};

function DashboardPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [pricingMode, setPricingMode] = useState<"padrao" | "custom" | null>(null);
  const [walletSummary, setWalletSummary] = useState<WalletSummary>(emptyWalletSummary);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [creditingBookingId, setCreditingBookingId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    const { data: bks } = await supabase
      .from("bookings")
      .select("*")
      .eq("teacher_id", user.id)
      .order("scheduled_at", { ascending: true });
    setBookings(bks || []);

    if (bks?.length) {
      const sids = Array.from(new Set(bks.map((b) => b.student_id)));
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", sids);
      setStudents(profs || []);
    } else {
      setStudents([]);
    }

    const [{ data: tp }, { data: summary }, { data: transactions }, { data: withdrawalRows }] =
      await Promise.all([
        supabase
          .from("teacher_profiles")
          .select("use_custom_pricing")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.rpc("get_teacher_wallet_summary").maybeSingle(),
        supabase
          .from("teacher_wallet_transactions")
          .select("*")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("teacher_withdrawal_requests")
          .select("*")
          .eq("teacher_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    setPricingMode(tp?.use_custom_pricing ? "custom" : "padrao");
    setWalletSummary(summary ?? emptyWalletSummary);
    setWalletTransactions(transactions ?? []);
    setWithdrawals(withdrawalRows ?? []);
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const upcoming = bookings.filter(
    (b) => new Date(b.scheduled_at) > new Date() && b.status !== "cancelado",
  );
  const classroomBookings = bookings.filter(
    (b) => b.status !== "cancelado" && b.status !== "concluido",
  );

  const handleCompleteBooking = async (bookingId: string) => {
    setCreditingBookingId(bookingId);
    const { data, error } = await supabase.rpc("credit_teacher_for_completed_booking", {
      _booking_id: bookingId,
    });
    setCreditingBookingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    const credited = data?.[0]?.teacher_amount ?? 0;
    toast.success(`Aula concluida. Credito liberado: ${formatMoney(credited)}.`);
    await loadDashboard();
  };

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="text-bronze text-xs uppercase tracking-widest font-medium">Dashboard</p>
            <h1 className="font-display text-3xl md:text-4xl text-wine font-bold mt-2">
              Olá, professor
            </h1>
          </div>
          {pricingMode && (
            <div
              className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm shadow-soft ${
                pricingMode === "padrao"
                  ? "bg-wine text-white border-wine"
                  : "bg-background border-bronze text-wine"
              }`}
            >
              {pricingMode === "padrao" ? (
                <>
                  <BadgeCheck className="h-5 w-5" />
                  <div className="text-left">
                    <p className="font-semibold leading-tight">Padrão Pedagógico GW</p>
                    <p
                      className={`text-[11px] ${pricingMode === "padrao" ? "text-white/70" : "text-brown-soft"}`}
                    >
                      Você opera com os valores oficiais da plataforma
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Wallet className="h-5 w-5 text-bronze" />
                  <div className="text-left">
                    <p className="font-semibold leading-tight">Valores personalizados</p>
                    <p className="text-[11px] text-brown-soft">
                      Você definiu seus próprios preços e condições
                    </p>
                  </div>
                </>
              )}
              <Link
                to="/cadastro/professor"
                className="ml-2 text-xs underline opacity-80 hover:opacity-100"
              >
                editar
              </Link>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Stat icon={Users} label="Alunos" value={students.length} />
          <Stat icon={Calendar} label="Próximas aulas" value={upcoming.length} />
          <Stat
            icon={BookOpen}
            label="Aulas dadas"
            value={bookings.filter((b) => b.status === "concluido").length}
          />
        </div>

        <Tabs
          defaultValue="agendamentos"
          className="bg-background rounded-3xl border border-border p-4 md:p-6 shadow-soft"
        >
          <TabsList className="bg-cream w-full justify-start flex-wrap h-auto">
            <TabsTrigger
              value="agendamentos"
              className="data-[state=active]:bg-wine data-[state=active]:text-white"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Sala de Aula
            </TabsTrigger>
            <TabsTrigger
              value="alunos"
              className="data-[state=active]:bg-wine data-[state=active]:text-white"
            >
              <Users className="h-4 w-4 mr-2" />
              Meus Alunos
            </TabsTrigger>
            <TabsTrigger
              value="disponibilidade"
              className="data-[state=active]:bg-wine data-[state=active]:text-white"
            >
              <Clock className="h-4 w-4 mr-2" />
              Disponibilidade
            </TabsTrigger>
            <TabsTrigger
              value="carteira"
              className="data-[state=active]:bg-wine data-[state=active]:text-white"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Carteira
            </TabsTrigger>
            <TabsTrigger
              value="material"
              className="data-[state=active]:bg-wine data-[state=active]:text-white"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Material
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agendamentos" className="mt-6">
            {classroomBookings.length === 0 ? (
              <Empty msg="Nenhuma aula agendada ainda." />
            ) : (
              <div className="space-y-3">
                {classroomBookings.map((b) => {
                  const s = students.find((x) => x.id === b.student_id);
                  const canComplete = new Date(b.scheduled_at) <= new Date();
                  return (
                    <div
                      key={b.id}
                      className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-border hover:border-bronze"
                    >
                      <div className="h-12 w-12 rounded-full bg-gradient-warm flex items-center justify-center text-white font-display flex-shrink-0">
                        {s?.avatar_url ? (
                          <img
                            src={s.avatar_url}
                            className="w-full h-full rounded-full object-cover"
                            alt=""
                          />
                        ) : (
                          s?.full_name?.charAt(0) || "A"
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-wine">{s?.full_name || "Aluno"}</p>
                        <p className="text-sm text-brown">
                          {format(new Date(b.scheduled_at), "EEEE, d 'de' MMMM 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </p>
                        {b.meeting_url && (
                          <p className="text-xs text-bronze truncate mt-1">🔗 {b.meeting_url}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs px-3 py-1 rounded-full bg-bronze/15 text-bronze capitalize">
                          {b.status}
                        </span>
                        <MeetingLinkEditor
                          bookingId={b.id}
                          initialUrl={b.meeting_url}
                          onSaved={(url) =>
                            setBookings((prev) =>
                              prev.map((x) => (x.id === b.id ? { ...x, meeting_url: url } : x)),
                            )
                          }
                        />
                        {canComplete && (
                          <Button
                            size="sm"
                            onClick={() => handleCompleteBooking(b.id)}
                            disabled={creditingBookingId === b.id}
                            className="bg-wine text-white hover:bg-bronze gap-2"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {creditingBookingId === b.id ? "Creditando..." : "Marcar concluida"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="alunos" className="mt-6">
            {students.length === 0 ? (
              <Empty msg="Você ainda não tem alunos." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {students.map((s) => (
                  <div
                    key={s.id}
                    className="p-5 rounded-2xl border border-border flex items-center gap-3"
                  >
                    <div className="h-12 w-12 rounded-full bg-gradient-warm flex items-center justify-center text-white font-display">
                      {s.avatar_url ? (
                        <img
                          src={s.avatar_url}
                          className="w-full h-full rounded-full object-cover"
                          alt=""
                        />
                      ) : (
                        s.full_name?.charAt(0)
                      )}
                    </div>
                    <p className="font-semibold text-wine">{s.full_name}</p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="disponibilidade" className="mt-6">
            <AvailabilityManager />
          </TabsContent>
          <TabsContent value="carteira" className="mt-6">
            <WalletPanel
              summary={walletSummary}
              transactions={walletTransactions}
              withdrawals={withdrawals}
              onChanged={loadDashboard}
            />
          </TabsContent>
          <TabsContent value="material" className="mt-6">
            <Empty msg="Faça upload de PDFs e materiais. Em breve." />
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center">
          <Link to="/cadastro/professor">
            <Button variant="outline" className="border-wine text-wine">
              Editar meu perfil
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}

function WalletPanel({
  summary,
  transactions,
  withdrawals,
  onChanged,
}: {
  summary: WalletSummary;
  transactions: WalletTransaction[];
  withdrawals: WithdrawalRequest[];
  onChanged: () => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [pixKeyType, setPixKeyType] = useState<WithdrawalRequest["pix_key_type"]>("cpf");
  const [pixKey, setPixKey] = useState("");
  const [holderName, setHolderName] = useState("");
  const [holderDocument, setHolderDocument] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseMoney(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount < 10) {
      toast.error("O saque minimo e de R$ 10,00.");
      return;
    }

    if (parsedAmount > Number(summary.available_balance || 0)) {
      toast.error("Valor maior que o saldo disponivel.");
      return;
    }

    if (pixKey.trim().length < 3 || holderName.trim().length < 2) {
      toast.error("Preencha a chave Pix e o nome do titular.");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc("request_teacher_withdrawal", {
      _amount: parsedAmount,
      _pix_key_type: pixKeyType,
      _pix_key: pixKey.trim(),
      _account_holder_name: holderName.trim(),
      _account_holder_document: holderDocument.trim() || null,
      _teacher_notes: null,
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Solicitacao de saque enviada.");
    setAmount("");
    setPixKey("");
    setHolderName("");
    setHolderDocument("");
    await onChanged();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <WalletStat
          icon={Wallet}
          label="Saldo disponivel"
          value={formatMoney(summary.available_balance)}
          strong
        />
        <WalletStat
          icon={Banknote}
          label="Total recebido"
          value={formatMoney(summary.total_received)}
        />
        <WalletStat icon={Send} label="Saques pagos" value={formatMoney(summary.total_withdrawn)} />
        <WalletStat
          icon={Clock}
          label="Saques pendentes"
          value={formatMoney(summary.pending_withdrawals)}
        />
      </div>

      <div className="rounded-2xl border border-bronze/30 bg-cream p-4 text-sm text-brown">
        <p className="font-semibold text-wine">Regra de repasse ativa</p>
        <p className="mt-1">
          A cada aula concluida, 90% do valor-hora do plano do aluno entra na carteira do professor
          e 10% fica como taxa da plataforma.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form
          onSubmit={submitWithdrawal}
          className="rounded-2xl border border-border p-5 space-y-4"
        >
          <div>
            <h3 className="font-display text-xl text-wine">Solicitar saque Pix</h3>
            <p className="text-sm text-brown-soft mt-1">
              O valor fica reservado ate a transferencia ser conferida pela plataforma.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Valor do saque</Label>
            <Input
              inputMode="decimal"
              placeholder="Ex: 150,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo da chave Pix</Label>
              <Select
                value={pixKeyType}
                onValueChange={(value) => setPixKeyType(value as WithdrawalRequest["pix_key_type"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="aleatoria">Chave aleatoria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chave Pix</Label>
              <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nome do titular</Label>
            <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>CPF/CNPJ do titular</Label>
            <Input
              inputMode="numeric"
              value={holderDocument}
              onChange={(e) => setHolderDocument(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={submitting || Number(summary.available_balance || 0) < 10}
            className="w-full bg-bronze text-white hover:bg-wine shadow-bronze gap-2"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Enviando..." : "Solicitar saque"}
          </Button>
        </form>

        <div className="rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-bronze" />
            <h3 className="font-display text-xl text-wine">Historico financeiro</h3>
          </div>
          {transactions.length === 0 ? (
            <Empty msg="Nenhum movimento na carteira ainda." />
          ) : (
            <div className="space-y-3">
              {transactions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0"
                >
                  <div>
                    <p className="font-semibold text-wine text-sm">
                      {transactionLabel(item.transaction_type)}
                    </p>
                    <p className="text-xs text-brown-soft">
                      {format(new Date(item.created_at), "dd/MM/yyyy 'as' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                    {item.gross_amount && (
                      <p className="text-[11px] text-brown-soft mt-1">
                        Bruto {formatMoney(item.gross_amount)} | taxa{" "}
                        {formatMoney(item.platform_fee ?? 0)}
                      </p>
                    )}
                  </div>
                  <p
                    className={`font-semibold ${Number(item.amount) >= 0 ? "text-emerald-700" : "text-wine"}`}
                  >
                    {Number(item.amount) >= 0 ? "+" : "-"}
                    {formatMoney(Math.abs(Number(item.amount)))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border p-5">
        <h3 className="font-display text-xl text-wine mb-4">Historico de transferencias</h3>
        {withdrawals.length === 0 ? (
          <Empty msg="Nenhuma solicitacao de saque ainda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-brown-soft border-b border-border">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Pix</th>
                  <th className="py-2 pr-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-b-0">
                    <td className="py-3 pr-3 text-brown">
                      {format(new Date(item.requested_at), "dd/MM/yyyy", { locale: ptBR })}
                    </td>
                    <td className="py-3 pr-3 font-semibold text-wine">
                      {formatMoney(item.amount)}
                    </td>
                    <td className="py-3 pr-3 text-brown">
                      {pixTypeLabel(item.pix_key_type)} | {maskPixKey(item.pix_key)}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="rounded-full bg-bronze/15 px-3 py-1 text-xs font-semibold text-bronze">
                        {withdrawalStatusLabel(item.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function WalletStat({
  icon: Icon,
  label,
  value,
  strong,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${strong ? "bg-wine text-white" : "bg-cream"}`}>
      <Icon className={`h-5 w-5 mb-3 ${strong ? "text-bronze" : "text-bronze"}`} />
      <p className={`text-2xl font-display font-bold ${strong ? "text-white" : "text-wine"}`}>
        {value}
      </p>
      <p className={`text-xs mt-1 ${strong ? "text-white/70" : "text-brown-soft"}`}>{label}</p>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="bg-background rounded-2xl border border-border p-5">
      <Icon className="h-5 w-5 text-bronze mb-2" />
      <p className="text-2xl font-display font-bold text-wine">{value}</p>
      <p className="text-xs text-brown-soft mt-1">{label}</p>
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-center py-12 text-brown-soft text-sm">{msg}</div>;
}

function formatMoney(value: number | string | null | undefined) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value ?? 0));
}

function parseMoney(value: string) {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return Number(normalized);
}

function transactionLabel(type: WalletTransaction["transaction_type"]) {
  const labels: Record<WalletTransaction["transaction_type"], string> = {
    lesson_credit: "Credito por aula concluida",
    withdrawal_hold: "Saque solicitado",
    withdrawal_reversal: "Saque estornado",
    manual_adjustment: "Ajuste manual",
  };
  return labels[type] ?? type;
}

function pixTypeLabel(type: WithdrawalRequest["pix_key_type"]) {
  const labels: Record<WithdrawalRequest["pix_key_type"], string> = {
    cpf: "CPF",
    email: "E-mail",
    telefone: "Telefone",
    aleatoria: "Aleatoria",
  };
  return labels[type] ?? type;
}

function withdrawalStatusLabel(status: WithdrawalRequest["status"]) {
  const labels: Record<WithdrawalRequest["status"], string> = {
    pendente: "Pendente",
    em_processamento: "Em processamento",
    pago: "Pago",
    falhou: "Falhou",
    cancelado: "Cancelado",
  };
  return labels[status] ?? status;
}

function maskPixKey(value: string) {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
