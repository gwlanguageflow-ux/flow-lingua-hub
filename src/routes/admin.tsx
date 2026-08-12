import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  AlertTriangle,
  Banknote,
  BarChart3,
  BellRing,
  Calendar,
  CheckCircle2,
  CreditCard,
  FileText,
  GraduationCap,
  History,
  LineChart,
  Mail,
  Megaphone,
  MessageCircle,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Upload,
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  activateStudentSubscriptionManually,
  cancelStudentSubscriptionByDirector,
  confirmTeacherWithdrawal,
  createDirectorAlert,
  createExternalPaidStudent,
  createDirectorMessage,
  getAdminDashboard,
  requestDirectorWithdrawal,
  sendDirectorDirectMessage,
  updateAnonymousReport,
  updateDirectorAlertStatus,
  updateStudentSubscriptionStatusByDirector,
} from "@/functions/admin.functions";
import { createDirectorCoupon } from "@/functions/coupon.functions";
import type { Enums, Tables, TablesInsert } from "@/integrations/supabase/types";
import { getProfileAvatarUrl } from "@/lib/profile-media";
import { normalizeExternalUrl } from "@/lib/resource-links";
import { supabase } from "@/integrations/supabase/client";
import { LEARNING_FILE_ACCEPT, getLastLearningUploadError, uploadLearningFile } from "@/lib/upload";

type Profile = Tables<"profiles">;
type TeacherProfile = Tables<"teacher_profiles">;
type StudentProfile = Tables<"student_profiles">;
type Booking = Tables<"bookings">;
type ClassGroup = Tables<"class_groups">;
type UserRole = Tables<"user_roles">;
type DirectorMessage = Tables<"director_messages">;
type DirectorAlert = Tables<"director_alerts">;
type DirectMessage = Tables<"director_user_messages">;
type AnonymousReport = Tables<"anonymous_reports">;
type PlatformWalletTransaction = Tables<"platform_wallet_transactions">;
type TeacherWalletTransaction = Tables<"teacher_wallet_transactions">;
type TeacherWithdrawalRequest = Tables<"teacher_withdrawal_requests">;
type TeacherPayoutProfile = Tables<"teacher_payout_profiles">;
type ClassMaterial = Tables<"class_materials">;
type DiscountCoupon = Tables<"discount_coupons">;
type CouponRedemption = Tables<"coupon_redemptions">;
type SubscriptionPlan = Pick<Tables<"subscription_plans">, "id" | "name" | "price" | "slug">;
type TeacherCustomPlan = Pick<
  Tables<"teacher_custom_plans">,
  "id" | "name" | "price" | "teacher_id"
>;
type AppRole = Enums<"app_role">;
type TargetType = "all" | "role" | "user" | "class";
type PlatformRange = "30d" | "90d" | "365d";

type StudentSubscription = Pick<
  Tables<"student_subscriptions">,
  | "id"
  | "student_id"
  | "teacher_id"
  | "plan_id"
  | "custom_plan_id"
  | "status"
  | "created_at"
  | "current_period_end"
  | "cancel_at_period_end"
  | "cancel_requested_at"
  | "package_type"
  | "package_months"
  | "package_total_amount"
> & {
  subscription_plans: Pick<Tables<"subscription_plans">, "id" | "name" | "price" | "slug"> | null;
  teacher_custom_plans: TeacherCustomPlan | null;
};

type PlatformChartPoint = {
  label: string;
  periodStart: string;
  platformFees: number;
  studentSignups: number;
};

type PlatformPlanRanking = {
  planId: string;
  planName: string;
  subscriptions: number;
  revenue: number;
  platformFees: number;
};

type PlatformWalletSummary = {
  totalPlatformFees: number;
  availableBalance: number;
  totalWithdrawn: number;
  transactionsCount: number;
  ranges: Record<PlatformRange, PlatformChartPoint[]>;
  planRanking: PlatformPlanRanking[];
};

type TargetForm = {
  targetType: TargetType;
  targetRole: AppRole;
  targetUserId: string;
  targetClassId: string;
};

const roleLabels: Record<AppRole, string> = {
  dev: "Diretoria",
  professor: "Professor",
  aluno: "Aluno",
};

const priorityLabels: Record<string, string> = {
  normal: "Normal",
  important: "Importante",
  urgent: "Urgente",
};

const toneLabels: Record<string, string> = {
  info: "Informativo",
  warning: "Atenção",
  urgent: "Urgente",
};

const statusLabels: Record<string, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  resolvido: "Resolvido",
  arquivado: "Arquivado",
};

const subscriptionStatusLabels: Record<string, string> = {
  pendente: "No aguardo",
  ativa: "Ativo",
  inadimplente: "Inadimplente",
  cancelada: "Cancelado",
  expirada: "Expirado",
};

const subscriptionStatusClasses: Record<string, string> = {
  pendente: "border-amber-300 bg-amber-50 text-amber-800",
  ativa: "border-emerald-300 bg-emerald-50 text-emerald-800",
  inadimplente: "border-red-300 bg-red-50 text-red-800",
  cancelada: "border-brown-soft/30 bg-cream text-brown",
  expirada: "border-brown-soft/30 bg-cream text-brown",
};

const emptyPlatformWalletSummary: PlatformWalletSummary = {
  totalPlatformFees: 0,
  availableBalance: 0,
  totalWithdrawn: 0,
  transactionsCount: 0,
  ranges: {
    "30d": [],
    "90d": [],
    "365d": [],
  },
  planRanking: [],
};

const platformRangeLabels: Record<PlatformRange, string> = {
  "30d": "30 dias",
  "90d": "Trimestre",
  "365d": "Anual",
};

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Diretoria — GWLanguageFlow" }] }),
  component: () => (
    <RequireAuth allow={["dev"]}>
      <AdminPage />
    </RequireAuth>
  ),
});

function AdminPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [directorMessages, setDirectorMessages] = useState<DirectorMessage[]>([]);
  const [directorAlerts, setDirectorAlerts] = useState<DirectorAlert[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [anonymousReports, setAnonymousReports] = useState<AnonymousReport[]>([]);
  const [subscriptions, setSubscriptions] = useState<StudentSubscription[]>([]);
  const [platformWalletTransactions, setPlatformWalletTransactions] = useState<
    PlatformWalletTransaction[]
  >([]);
  const [teacherWalletTransactions, setTeacherWalletTransactions] = useState<
    TeacherWalletTransaction[]
  >([]);
  const [teacherWithdrawals, setTeacherWithdrawals] = useState<TeacherWithdrawalRequest[]>([]);
  const [teacherPayoutProfiles, setTeacherPayoutProfiles] = useState<TeacherPayoutProfile[]>([]);
  const [classMaterials, setClassMaterials] = useState<ClassMaterial[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [teacherCustomPlans, setTeacherCustomPlans] = useState<TeacherCustomPlan[]>([]);
  const [discountCoupons, setDiscountCoupons] = useState<DiscountCoupon[]>([]);
  const [couponRedemptions, setCouponRedemptions] = useState<CouponRedemption[]>([]);
  const [platformWalletSummary, setPlatformWalletSummary] = useState<PlatformWalletSummary>(
    emptyPlatformWalletSummary,
  );
  const [platformRange, setPlatformRange] = useState<PlatformRange>("30d");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userFilter, setUserFilter] = useState<"all" | "professor" | "aluno">("all");
  const [studentStatusFilter, setStudentStatusFilter] = useState<"all" | "pendente" | "ativa">(
    "all",
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [messageForm, setMessageForm] = useState(
    withTargetDefaults({
      title: "",
      body: "",
      priority: "normal",
    }),
  );
  const [alertForm, setAlertForm] = useState(
    withTargetDefaults({
      title: "",
      body: "",
      tone: "info",
      active: true,
      expiresAt: "",
    }),
  );
  const [directBody, setDirectBody] = useState("");
  const [reportDrafts, setReportDrafts] = useState<
    Record<string, { status: string; notes: string }>
  >({});

  const loadDashboard = useCallback(async () => {
    try {
      setError(null);
      const data = await getAdminDashboard();
      const dashboard = normalizeAdminDashboard(data);
      setProfiles(dashboard.profiles);
      setRoles(dashboard.roles);
      setTeachers(dashboard.teachers);
      setStudents(dashboard.students);
      setBookings(dashboard.bookings);
      setClasses(dashboard.classes);
      setDirectorMessages(dashboard.directorMessages);
      setDirectorAlerts(dashboard.directorAlerts);
      setDirectMessages(dashboard.directMessages);
      setAnonymousReports(dashboard.anonymousReports);
      setSubscriptions(dashboard.subscriptions);
      setPlatformWalletTransactions(dashboard.platformWalletTransactions);
      setTeacherWalletTransactions(dashboard.teacherWalletTransactions);
      setTeacherWithdrawals(dashboard.teacherWithdrawals);
      setTeacherPayoutProfiles(dashboard.teacherPayoutProfiles);
      setClassMaterials(dashboard.classMaterials);
      setSubscriptionPlans(dashboard.subscriptionPlans);
      setTeacherCustomPlans(dashboard.teacherCustomPlans);
      setDiscountCoupons(dashboard.discountCoupons);
      setCouponRedemptions(dashboard.couponRedemptions);
      setPlatformWalletSummary(dashboard.platformWalletSummary);
      setReportDrafts(
        Object.fromEntries(
          dashboard.anonymousReports.map((report) => [
            report.id,
            { status: report.status, notes: report.admin_notes ?? "" },
          ]),
        ),
      );
      setSelectedUserId((current) => current || dashboard.profiles[0]?.id || "");
    } catch {
      setError("Não foi possível carregar a Diretoria.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const channel = supabase
      .channel("director-live-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "anonymous_reports" }, () =>
        loadDashboard(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "director_alerts" }, () =>
        loadDashboard(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "director_messages" }, () =>
        loadDashboard(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "director_user_messages" },
        () => loadDashboard(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teacher_withdrawal_requests" },
        () => loadDashboard(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "class_materials" }, () =>
        loadDashboard(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "material_requests" }, () =>
        loadDashboard(),
      )
      .subscribe();

    const interval = window.setInterval(loadDashboard, 20000);
    const onFocus = () => loadDashboard();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [loadDashboard]);

  const roleByUser = useMemo(() => {
    const map = new Map<string, AppRole[]>();
    roles.forEach((role) => {
      map.set(role.user_id, [...(map.get(role.user_id) ?? []), role.role]);
    });
    return map;
  }, [roles]);

  const teacherById = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.id, teacher])),
    [teachers],
  );
  const studentById = useMemo(
    () => new Map(students.map((student) => [student.id, student])),
    [students],
  );
  const latestSubscriptionByStudent = useMemo(() => {
    const map = new Map<string, StudentSubscription>();
    subscriptions.forEach((subscription) => {
      const current = map.get(subscription.student_id);
      if (!current || new Date(subscription.created_at) > new Date(current.created_at)) {
        map.set(subscription.student_id, subscription);
      }
    });
    return map;
  }, [subscriptions]);
  const studentStatusCounts = useMemo(() => {
    const studentIds = new Set(
      roles.filter((role) => role.role === "aluno").map((role) => role.user_id),
    );
    let waiting = 0;
    let active = 0;
    studentIds.forEach((studentId) => {
      const status = latestSubscriptionByStudent.get(studentId)?.status;
      if (status === "pendente") waiting += 1;
      if (status === "ativa") active += 1;
    });
    return { waiting, active };
  }, [latestSubscriptionByStudent, roles]);
  const classById = useMemo(() => new Map(classes.map((item) => [item.id, item])), [classes]);

  const userProfiles = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const statusWeight: Record<string, number> = { pendente: 0, ativa: 1 };
    return profiles
      .filter((profile) => {
        const userRoles = roleByUser.get(profile.id) ?? [];
        const roleMatch = userFilter === "all" || userRoles.includes(userFilter);
        const statusMatch =
          studentStatusFilter === "all" ||
          (userRoles.includes("aluno") &&
            latestSubscriptionByStudent.get(profile.id)?.status === studentStatusFilter);
        const searchMatch = !needle || profileSearchText(profile).includes(needle);
        return roleMatch && statusMatch && searchMatch;
      })
      .sort((a, b) => {
        const aStatus = latestSubscriptionByStudent.get(a.id)?.status ?? "";
        const bStatus = latestSubscriptionByStudent.get(b.id)?.status ?? "";
        return (statusWeight[aStatus] ?? 3) - (statusWeight[bStatus] ?? 3);
      });
  }, [latestSubscriptionByStudent, profiles, roleByUser, search, studentStatusFilter, userFilter]);

  const selectedUser =
    profiles.find((profile) => profile.id === selectedUserId) ?? userProfiles[0] ?? null;
  const selectedRoles = selectedUser ? (roleByUser.get(selectedUser.id) ?? []) : [];
  const selectedTeacher = selectedUser ? teacherById.get(selectedUser.id) : null;
  const selectedStudent = selectedUser ? studentById.get(selectedUser.id) : null;
  const selectedSubscription = selectedUser
    ? latestSubscriptionByStudent.get(selectedUser.id)
    : null;
  const selectedDirectMessages = selectedUser
    ? directMessages.filter((message) => message.user_id === selectedUser.id)
    : [];
  const openReports = anonymousReports.filter((report) => report.status === "novo").length;

  const handleCreateMessage = async () => {
    setSending(true);
    try {
      await createDirectorMessage({
        data: {
          ...targetPayload(messageForm),
          title: messageForm.title,
          body: messageForm.body,
          priority: messageForm.priority as "normal" | "important" | "urgent",
        },
      });
      toast.success("Comunicado enviado.");
      setMessageForm((form) => ({ ...form, title: "", body: "" }));
      await loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o comunicado.");
    } finally {
      setSending(false);
    }
  };

  const handleCreateAlert = async () => {
    setSending(true);
    try {
      await createDirectorAlert({
        data: {
          ...targetPayload(alertForm),
          title: alertForm.title,
          body: alertForm.body,
          tone: alertForm.tone as "info" | "warning" | "urgent",
          active: true,
          expiresAt: alertForm.expiresAt ? new Date(alertForm.expiresAt).toISOString() : null,
        },
      });
      toast.success("Alerta criado.");
      setAlertForm((form) => ({ ...form, title: "", body: "", expiresAt: "" }));
      await loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o alerta.");
    } finally {
      setSending(false);
    }
  };

  const handleSendDirect = async () => {
    if (!selectedUser) return;
    setSending(true);
    try {
      await sendDirectorDirectMessage({
        data: {
          userId: selectedUser.id,
          body: directBody,
        },
      });
      toast.success("Mensagem enviada.");
      setDirectBody("");
      await loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  };

  const handleReportSave = async (reportId: string) => {
    const draft = reportDrafts[reportId];
    if (!draft) return;
    try {
      await updateAnonymousReport({
        data: {
          reportId,
          status: draft.status as "novo" | "em_analise" | "resolvido" | "arquivado",
          adminNotes: draft.notes || null,
        },
      });
      toast.success("Denúncia atualizada.");
      await loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a denúncia.");
    }
  };

  const handleAlertStatus = async (alertId: string, active: boolean) => {
    try {
      await updateDirectorAlertStatus({ data: { alertId, active } });
      toast.success(active ? "Alerta reativado." : "Alerta pausado.");
      await loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o alerta.");
    }
  };

  const handleActivateStudent = async (subscriptionId: string) => {
    setSending(true);
    try {
      await activateStudentSubscriptionManually({ data: { subscriptionId } });
      toast.success("Aluno ativado e carteira do professor creditada.");
      await loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel ativar o aluno.");
    } finally {
      setSending(false);
    }
  };

  const handleManualSubscriptionStatus = async (
    subscriptionId: string,
    status: "ativa" | "inadimplente",
  ) => {
    setSending(true);
    try {
      await updateStudentSubscriptionStatusByDirector({ data: { subscriptionId, status } });
      toast.success(
        status === "ativa"
          ? "Aluno marcado como ativo manualmente."
          : "Aluno marcado como inadimplente manualmente.",
      );
      await loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel alterar o status.");
    } finally {
      setSending(false);
    }
  };

  const handleCancelStudentSubscription = async (subscriptionId: string) => {
    setSending(true);
    try {
      await cancelStudentSubscriptionByDirector({
        data: {
          subscriptionId,
          reason: "Cancelamento solicitado pela diretoria",
        },
      });
      toast.success("Cancelamento programado. O acesso segue ate o fim do periodo pago.");
      await loadDashboard();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel cancelar a assinatura.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="gw-app-shell min-h-screen">
      <SiteHeader />
      <main className="container mx-auto max-w-7xl px-4 py-8 md:py-10">
        <div className="gw-command-hero mb-6 flex flex-col gap-4 rounded-xl p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <p className="gw-section-kicker">Administração</p>
            <h1 className="mt-2 font-display text-3xl font-bold text-wine md:text-5xl">
              Diretoria
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-brown-soft">
              Central para comunicados, avisos, denúncias e conversas diretas com alunos e
              professores.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="w-full rounded-lg md:w-auto">
              <Link to="/admin/lgpd">Painel LGPD</Link>
            </Button>
            <Button
              onClick={loadDashboard}
              variant="outline"
              className="w-full rounded-lg md:w-auto"
            >
              Atualizar painel
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Stat icon={Users} label="Usuários" value={profiles.length} />
          <Stat icon={GraduationCap} label="Professores" value={teachers.length} />
          <Stat icon={UserRound} label="Alunos" value={students.length} />
          <Stat icon={AlertTriangle} label="No aguardo" value={studentStatusCounts.waiting} />
          <Stat icon={CheckCircle2} label="Alunos ativos" value={studentStatusCounts.active} />
          <Stat icon={ShieldAlert} label="Denúncias novas" value={openReports} />
          <Stat
            icon={Wallet}
            label="Saldo plataforma"
            value={formatMoney(platformWalletSummary.availableBalance)}
          />
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mb-6 rounded-xl border border-bronze/30 bg-bronze/10 p-4 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white text-bronze shadow-soft">
              <BellRing className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-full bg-wine text-white">Atualizacao publicada</Badge>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-bronze">
                  Aviso da plataforma
                </p>
              </div>
              <h2 className="mt-2 font-display text-xl font-bold text-wine">
                Cadastro de alunos pagos por fora liberado para a Diretoria.
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-brown">
                A nova aba <strong>Alunos externos</strong> permite criar ou localizar um aluno,
                escolher a professora, selecionar plano da plataforma ou plano proprio do professor
                e liberar o acesso mantendo o registro financeiro dentro da plataforma.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-background p-8 text-center text-sm text-brown-soft">
            Carregando Diretoria...
          </div>
        ) : (
          <Tabs defaultValue="comunicados" className="gw-app-card rounded-xl p-3 md:p-5">
            <TabsList className="gw-tab-list mb-4 h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
              <Tab value="comunicados" icon={Megaphone} label="Comunicados" />
              <Tab value="usuarios" icon={MessageCircle} label="Usuários" />
              <Tab value="alertas" icon={BellRing} label="Alertas" />
              <Tab value="denuncias" icon={ShieldAlert} label="Denúncias" />
              <Tab value="materiais" icon={FileText} label="Materiais base" />
              <Tab value="externos" icon={UserPlus} label="Alunos externos" />
              <Tab value="cupons" icon={Sparkles} label="Cupons" />
              <Tab value="carteira" icon={Wallet} label="Carteira" />
              <Tab value="operacao" icon={Calendar} label="Operação" />
            </TabsList>

            <TabsContent value="comunicados" className="mt-0">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <section className="rounded-xl border border-border bg-white p-4">
                  <SectionTitle icon={Megaphone} title="Novo comunicado" />
                  <TargetControls
                    form={messageForm}
                    onChange={setMessageForm}
                    profiles={profiles}
                    classes={classes}
                    roleByUser={roleByUser}
                  />
                  <div className="mt-4 grid gap-3">
                    <Field label="Título">
                      <Input
                        value={messageForm.title}
                        onChange={(event) =>
                          setMessageForm((form) => ({ ...form, title: event.target.value }))
                        }
                        placeholder="Ex.: Reunião pedagógica desta semana"
                      />
                    </Field>
                    <Field label="Prioridade">
                      <Select
                        value={messageForm.priority}
                        onValueChange={(value) =>
                          setMessageForm((form) => ({ ...form, priority: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="important">Importante</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Mensagem">
                      <Textarea
                        value={messageForm.body}
                        onChange={(event) =>
                          setMessageForm((form) => ({ ...form, body: event.target.value }))
                        }
                        placeholder="Escreva o comunicado que aparecerá para o público selecionado."
                        className="min-h-32"
                      />
                    </Field>
                    <Button
                      onClick={handleCreateMessage}
                      disabled={sending}
                      className="rounded-lg bg-wine text-white hover:bg-bronze"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Enviar comunicado
                    </Button>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-white p-4">
                  <SectionTitle icon={Mail} title="Comunicados recentes" />
                  <div className="mt-4 space-y-3">
                    {directorMessages.length === 0 ? (
                      <EmptyState text="Nenhum comunicado enviado." />
                    ) : (
                      directorMessages.map((message) => (
                        <ArticleItem
                          key={message.id}
                          title={message.title}
                          meta={`${targetLabel(message, profiles, classById)} • ${priorityLabels[message.priority] ?? message.priority}`}
                          body={message.body}
                          date={message.created_at}
                          urgent={message.priority === "urgent"}
                        />
                      ))
                    )}
                  </div>
                </section>
              </div>
            </TabsContent>

            <TabsContent value="usuarios" className="mt-0">
              <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
                <section className="rounded-xl border border-border bg-white p-4">
                  <SectionTitle icon={Users} title="Perfis" />
                  <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brown-soft" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar nome ou e-mail"
                        className="pl-9"
                      />
                    </div>
                    <Select
                      value={userFilter}
                      onValueChange={(value) => setUserFilter(value as typeof userFilter)}
                    >
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="professor">Professores</SelectItem>
                        <SelectItem value="aluno">Alunos</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={studentStatusFilter}
                      onValueChange={(value) =>
                        setStudentStatusFilter(value as typeof studentStatusFilter)
                      }
                    >
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos status</SelectItem>
                        <SelectItem value="pendente">No aguardo</SelectItem>
                        <SelectItem value="ativa">Ativos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
                    {userProfiles.length === 0 ? (
                      <EmptyState text="Nenhum perfil encontrado." />
                    ) : (
                      userProfiles.map((profile) => {
                        const userRoles = roleByUser.get(profile.id) ?? [];
                        const subscription = latestSubscriptionByStudent.get(profile.id);
                        const active = selectedUser?.id === profile.id;
                        return (
                          <button
                            key={profile.id}
                            onClick={() => setSelectedUserId(profile.id)}
                            className={`w-full rounded-xl border p-3 text-left transition ${
                              active
                                ? "border-wine bg-cream text-wine"
                                : "border-border bg-background text-brown hover:border-bronze/60"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-3">
                                <ProfileAvatar profile={profile} size="sm" />
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold">
                                    {profileDisplayName(profile)}
                                  </p>
                                  <p className="truncate text-xs text-brown-soft">
                                    {profile.email ?? "Sem e-mail"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                                {userRoles.includes("aluno") && (
                                  <Badge
                                    variant="outline"
                                    className={`rounded-full ${subscriptionStatusClass(subscription?.status)}`}
                                  >
                                    {subscriptionStatusLabel(subscription?.status)}
                                  </Badge>
                                )}
                                {userRoles.map((role) => (
                                  <Badge key={role} variant="secondary" className="rounded-full">
                                    {roleLabels[role]}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-white p-4">
                  {selectedUser ? (
                    <>
                      <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
                        <div className="flex min-w-0 items-start gap-4">
                          <ProfileAvatar profile={selectedUser} />
                          <div className="min-w-0">
                            <h2 className="text-2xl font-bold text-wine">
                              {profileDisplayName(selectedUser)}
                            </h2>
                            <p className="text-sm text-brown-soft">
                              {selectedUser.email ?? "Sem e-mail cadastrado"}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {selectedRoles.map((role) => (
                                <Badge key={role} className="rounded-full bg-wine text-white">
                                  {roleLabels[role]}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl border border-border bg-cream px-4 py-3 text-sm text-brown">
                          Criado em {new Date(selectedUser.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <Info label="CPF" value={selectedUser.cpf || "Não informado"} />
                        <Info
                          label="Idade"
                          value={selectedUser.age ? `${selectedUser.age} anos` : "Não informada"}
                        />
                        {selectedTeacher && (
                          <>
                            <Info
                              label="Idiomas do professor"
                              value={
                                (selectedTeacher.languages_taught || []).join(", ") ||
                                "Não informado"
                              }
                            />
                            <Info
                              label="Hora/aula"
                              value={`R$ ${Number(selectedTeacher.hourly_rate || 0).toFixed(2)}`}
                            />
                          </>
                        )}
                        {selectedStudent && (
                          <>
                            <Info
                              label="Idioma desejado"
                              value={selectedStudent.desired_language || "Não informado"}
                            />
                            <Info
                              label="Nível"
                              value={selectedStudent.comprehension_level || "Não informado"}
                            />
                          </>
                        )}
                      </div>

                      {selectedRoles.includes("aluno") && (
                        <div className="mt-4 rounded-xl border border-border bg-background p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-bold text-wine">
                                  Status comercial do aluno
                                </h3>
                                <Badge
                                  variant="outline"
                                  className={`rounded-full ${subscriptionStatusClass(selectedSubscription?.status)}`}
                                >
                                  {subscriptionStatusLabel(selectedSubscription?.status)}
                                </Badge>
                              </div>
                              {selectedSubscription ? (
                                <div className="mt-3 grid gap-2 text-sm text-brown md:grid-cols-2">
                                  <span>
                                    Plano:{" "}
                                    <strong>
                                      {selectedSubscription.subscription_plans?.name ??
                                        selectedSubscription.teacher_custom_plans?.name ??
                                        "Plano"}
                                    </strong>
                                  </span>
                                  <span>
                                    Professor:{" "}
                                    <strong>
                                      {selectedSubscription.teacher_id
                                        ? userName(selectedSubscription.teacher_id, profiles)
                                        : "Professor nao vinculado"}
                                    </strong>
                                  </span>
                                  <span>
                                    Solicitado em:{" "}
                                    <strong>
                                      {new Date(selectedSubscription.created_at).toLocaleString(
                                        "pt-BR",
                                      )}
                                    </strong>
                                  </span>
                                  <span>
                                    Pacote:{" "}
                                    <strong>
                                      {subscriptionPackageLabel(selectedSubscription.package_type)}
                                    </strong>
                                  </span>
                                  <span>
                                    Valido ate:{" "}
                                    <strong>
                                      {selectedSubscription.current_period_end
                                        ? new Date(
                                            selectedSubscription.current_period_end,
                                          ).toLocaleDateString("pt-BR")
                                        : "Periodo nao definido"}
                                    </strong>
                                  </span>
                                  {selectedSubscription.package_total_amount ? (
                                    <span>
                                      Valor do pacote:{" "}
                                      <strong>
                                        {formatMoney(
                                          Number(selectedSubscription.package_total_amount),
                                        )}
                                      </strong>
                                    </span>
                                  ) : null}
                                </div>
                              ) : (
                                <p className="mt-2 text-sm text-brown-soft">
                                  O aluno ainda nao solicitou assinatura.
                                </p>
                              )}
                              {selectedSubscription?.cancel_at_period_end && (
                                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                  Cancelamento programado para o fim do periodo atual.
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col gap-2">
                              {selectedSubscription?.status === "pendente" && (
                                <Button
                                  onClick={() => handleActivateStudent(selectedSubscription.id)}
                                  disabled={sending}
                                  className="rounded-lg bg-wine text-white hover:bg-bronze"
                                >
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Ativar aluno
                                </Button>
                              )}
                              {selectedSubscription &&
                                selectedSubscription.status !== "cancelada" &&
                                selectedSubscription.status !== "expirada" && (
                                  <div className="rounded-xl border border-border bg-white p-3">
                                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-brown-soft">
                                      Ajuste manual
                                    </p>
                                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-1">
                                      <Button
                                        onClick={() =>
                                          handleManualSubscriptionStatus(
                                            selectedSubscription.id,
                                            "ativa",
                                          )
                                        }
                                        disabled={
                                          sending || selectedSubscription.status === "ativa"
                                        }
                                        variant="outline"
                                        className="rounded-lg border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                                      >
                                        Marcar ativo
                                      </Button>
                                      <Button
                                        onClick={() =>
                                          handleManualSubscriptionStatus(
                                            selectedSubscription.id,
                                            "inadimplente",
                                          )
                                        }
                                        disabled={
                                          sending || selectedSubscription.status === "inadimplente"
                                        }
                                        variant="outline"
                                        className="rounded-lg border-red-200 bg-white text-red-700 hover:bg-red-50"
                                      >
                                        Marcar inadimplente
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              {selectedSubscription &&
                                !selectedSubscription.cancel_at_period_end &&
                                selectedSubscription.status !== "cancelada" &&
                                selectedSubscription.status !== "expirada" && (
                                  <Button
                                    onClick={() =>
                                      handleCancelStudentSubscription(selectedSubscription.id)
                                    }
                                    disabled={sending}
                                    variant="outline"
                                    className="rounded-lg border-red-200 bg-white text-red-700 hover:bg-red-50"
                                  >
                                    Cancelar assinatura do aluno
                                  </Button>
                                )}
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="mt-5 rounded-xl border border-border bg-cream p-3">
                        <div className="mb-3 flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-bronze" />
                          <h3 className="text-sm font-bold text-wine">Conversa direta</h3>
                        </div>
                        <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-white p-3">
                          {selectedDirectMessages.length === 0 ? (
                            <p className="py-8 text-center text-sm text-brown-soft">
                              Sem mensagens diretas ainda.
                            </p>
                          ) : (
                            selectedDirectMessages.map((message) => {
                              const fromUser = message.sender_id === selectedUser.id;
                              return (
                                <div
                                  key={message.id}
                                  className={`flex ${fromUser ? "justify-start" : "justify-end"}`}
                                >
                                  <div
                                    className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${
                                      fromUser ? "bg-cream text-brown" : "bg-wine text-white"
                                    }`}
                                  >
                                    <p>{message.body}</p>
                                    <p
                                      className={`mt-1 text-[10px] ${fromUser ? "text-brown-soft" : "text-white/70"}`}
                                    >
                                      {new Date(message.created_at).toLocaleString("pt-BR")}
                                    </p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <Input
                            value={directBody}
                            onChange={(event) => setDirectBody(event.target.value)}
                            placeholder={`Mensagem para ${profileDisplayName(selectedUser)}`}
                          />
                          <Button
                            onClick={handleSendDirect}
                            disabled={sending || !directBody.trim()}
                            className="rounded-lg bg-wine text-white hover:bg-bronze"
                          >
                            <Send className="mr-2 h-4 w-4" />
                            Enviar
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <EmptyState text="Selecione um usuário para ver o perfil." />
                  )}
                </section>
              </div>
            </TabsContent>

            <TabsContent value="alertas" className="mt-0">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <section className="rounded-xl border border-border bg-white p-4">
                  <SectionTitle icon={BellRing} title="Novo alerta brilhante" />
                  <TargetControls
                    form={alertForm}
                    onChange={setAlertForm}
                    profiles={profiles}
                    classes={classes}
                    roleByUser={roleByUser}
                  />
                  <div className="mt-4 grid gap-3">
                    <Field label="Título">
                      <Input
                        value={alertForm.title}
                        onChange={(event) =>
                          setAlertForm((form) => ({ ...form, title: event.target.value }))
                        }
                        placeholder="Ex.: Aviso importante"
                      />
                    </Field>
                    <Field label="Intensidade">
                      <Select
                        value={alertForm.tone}
                        onValueChange={(value) =>
                          setAlertForm((form) => ({ ...form, tone: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="info">Informativo</SelectItem>
                          <SelectItem value="warning">Atenção</SelectItem>
                          <SelectItem value="urgent">Urgente</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Expira em">
                      <Input
                        type="datetime-local"
                        value={alertForm.expiresAt}
                        onChange={(event) =>
                          setAlertForm((form) => ({ ...form, expiresAt: event.target.value }))
                        }
                      />
                    </Field>
                    <Field label="Aviso">
                      <Textarea
                        value={alertForm.body}
                        onChange={(event) =>
                          setAlertForm((form) => ({ ...form, body: event.target.value }))
                        }
                        placeholder="Este aviso aparecerá em destaque para o usuário."
                        className="min-h-28"
                      />
                    </Field>
                    <Button
                      onClick={handleCreateAlert}
                      disabled={sending}
                      className="rounded-lg bg-wine text-white hover:bg-bronze"
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Criar alerta
                    </Button>
                  </div>
                </section>

                <section className="rounded-xl border border-border bg-white p-4">
                  <SectionTitle icon={AlertTriangle} title="Alertas ativos e recentes" />
                  <div className="mt-4 space-y-3">
                    {directorAlerts.length === 0 ? (
                      <EmptyState text="Nenhum alerta criado." />
                    ) : (
                      directorAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="rounded-xl border border-border bg-background p-3"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-wine">{alert.title}</h3>
                                <Badge
                                  className={`rounded-full ${alert.active ? "bg-emerald-700" : "bg-brown-soft"} text-white`}
                                >
                                  {alert.active ? "Ativo" : "Pausado"}
                                </Badge>
                                <Badge variant="outline" className="rounded-full">
                                  {toneLabels[alert.tone] ?? alert.tone}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-brown-soft">
                                {targetLabel(alert, profiles, classById)}
                              </p>
                              <p className="mt-2 text-sm text-brown">{alert.body}</p>
                            </div>
                            <Button
                              onClick={() => handleAlertStatus(alert.id, !alert.active)}
                              variant="outline"
                              className="rounded-full"
                            >
                              {alert.active ? "Pausar" : "Ativar"}
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </TabsContent>

            <TabsContent value="denuncias" className="mt-0">
              <section className="rounded-xl border border-border bg-white p-4">
                <SectionTitle icon={ShieldAlert} title="Denúncias anônimas" />
                <div className="mt-4 grid gap-3">
                  {anonymousReports.length === 0 ? (
                    <EmptyState text="Nenhuma denúncia recebida." />
                  ) : (
                    anonymousReports.map((report) => {
                      const draft = reportDrafts[report.id] ?? {
                        status: report.status,
                        notes: report.admin_notes ?? "",
                      };
                      return (
                        <div
                          key={report.id}
                          className="rounded-xl border border-border bg-background p-4"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-wine">{report.title}</h3>
                                <Badge className="rounded-full bg-wine text-white">
                                  {statusLabels[report.status] ?? report.status}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs uppercase tracking-wide text-bronze">
                                {report.category}
                              </p>
                              <p className="mt-2 text-sm text-brown">{report.body}</p>
                              <p className="mt-2 text-xs text-brown-soft">
                                Recebida em {new Date(report.created_at).toLocaleString("pt-BR")}
                              </p>
                            </div>
                            <div className="grid min-w-0 gap-2 md:w-80">
                              <Select
                                value={draft.status}
                                onValueChange={(value) =>
                                  setReportDrafts((drafts) => ({
                                    ...drafts,
                                    [report.id]: { ...draft, status: value },
                                  }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="novo">Novo</SelectItem>
                                  <SelectItem value="em_analise">Em análise</SelectItem>
                                  <SelectItem value="resolvido">Resolvido</SelectItem>
                                  <SelectItem value="arquivado">Arquivado</SelectItem>
                                </SelectContent>
                              </Select>
                              <Textarea
                                value={draft.notes}
                                onChange={(event) =>
                                  setReportDrafts((drafts) => ({
                                    ...drafts,
                                    [report.id]: { ...draft, notes: event.target.value },
                                  }))
                                }
                                placeholder="Observações internas"
                              />
                              <Button
                                onClick={() => handleReportSave(report.id)}
                                variant="outline"
                                className="rounded-full"
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Salvar análise
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="carteira" className="mt-0">
              <DirectorWalletPanel
                summary={platformWalletSummary}
                transactions={platformWalletTransactions}
                teacherWithdrawals={teacherWithdrawals}
                teacherWalletTransactions={teacherWalletTransactions}
                teacherPayoutProfiles={teacherPayoutProfiles}
                profiles={profiles}
                teachers={teachers}
                range={platformRange}
                onRangeChange={setPlatformRange}
                onChanged={loadDashboard}
              />
            </TabsContent>

            <TabsContent value="materiais" className="mt-0">
              <DirectorMaterialsPanel
                profiles={profiles}
                classes={classes}
                roleByUser={roleByUser}
                materials={classMaterials}
                onChanged={loadDashboard}
              />
            </TabsContent>

            <TabsContent value="externos" className="mt-0">
              <ExternalPaidStudentsPanel
                profiles={profiles}
                teachers={teachers}
                subscriptionPlans={subscriptionPlans}
                teacherCustomPlans={teacherCustomPlans}
                onChanged={loadDashboard}
              />
            </TabsContent>

            <TabsContent value="cupons" className="mt-0">
              <DirectorCouponsPanel
                coupons={discountCoupons}
                redemptions={couponRedemptions}
                profiles={profiles}
                onChanged={loadDashboard}
              />
            </TabsContent>

            <TabsContent value="operacao" className="mt-0">
              <section className="rounded-xl border border-border bg-white p-4">
                <SectionTitle icon={Calendar} title="Agendamentos recentes" />
                <div className="mt-4 overflow-x-auto">
                  <Table
                    headers={["Data", "Aluno", "Professor", "Duração", "Status"]}
                    rows={bookings.map((booking) => [
                      new Date(booking.scheduled_at).toLocaleString("pt-BR"),
                      userName(booking.student_id, profiles),
                      userName(booking.teacher_id, profiles),
                      `${booking.duration_minutes} min`,
                      booking.status,
                    ])}
                  />
                </div>
              </section>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

function ExternalPaidStudentsPanel({
  profiles,
  teachers,
  subscriptionPlans,
  teacherCustomPlans,
  onChanged,
}: {
  profiles: Profile[];
  teachers: TeacherProfile[];
  subscriptionPlans: SubscriptionPlan[];
  teacherCustomPlans: TeacherCustomPlan[];
  onChanged: () => void | Promise<void>;
}) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    cpf: "",
    age: "",
    desiredLanguage: "Inglês",
    comprehensionLevel: "iniciante",
    teacherId: teachers[0]?.id ?? "",
    planMode: "platform" as "platform" | "custom",
    planId: subscriptionPlans[0]?.id ?? "",
    customPlanId: "",
    paidAmount: "",
    periodStart: "",
    periodEnd: "",
    paymentReference: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);
  const [createdAccess, setCreatedAccess] = useState<{
    email: string;
    temporaryPassword: string | null;
  } | null>(null);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );
  const activeTeachers = useMemo(() => teachers.filter((teacher) => teacher.is_active), [teachers]);
  const teacherPlans = useMemo(
    () => teacherCustomPlans.filter((plan) => plan.teacher_id === form.teacherId),
    [form.teacherId, teacherCustomPlans],
  );
  const selectedPlatformPlan = subscriptionPlans.find((plan) => plan.id === form.planId);
  const selectedCustomPlan = teacherPlans.find((plan) => plan.id === form.customPlanId);
  const selectedPlanValue =
    form.planMode === "platform" ? selectedPlatformPlan?.price : selectedCustomPlan?.price;

  const updateForm = (patch: Partial<typeof form>) =>
    setForm((current) => ({ ...current, ...patch }));

  const toIsoOrNull = (value: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error("Informe uma data valida.");
    return date.toISOString();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setCreatedAccess(null);
    try {
      if (!form.teacherId) throw new Error("Selecione o professor.");
      if (form.planMode === "platform" && !form.planId) {
        throw new Error("Selecione um plano da plataforma.");
      }
      if (form.planMode === "custom" && !form.customPlanId) {
        throw new Error("Selecione um plano proprio do professor.");
      }

      const result = await createExternalPaidStudent({
        data: {
          fullName: form.fullName,
          email: form.email,
          cpf: form.cpf || null,
          age: form.age ? Number(form.age) : null,
          desiredLanguage: form.desiredLanguage,
          comprehensionLevel: form.comprehensionLevel as
            | "iniciante"
            | "basico"
            | "intermediario"
            | "avancado"
            | "fluente",
          teacherId: form.teacherId,
          planId: form.planMode === "platform" ? form.planId : null,
          customPlanId: form.planMode === "custom" ? form.customPlanId : null,
          paidAmount: form.paidAmount ? parseMoney(form.paidAmount) : null,
          periodStart: toIsoOrNull(form.periodStart),
          periodEnd: toIsoOrNull(form.periodEnd),
          paymentReference: form.paymentReference || null,
          note: form.note || null,
        },
      });

      setCreatedAccess({
        email: form.email.trim().toLowerCase(),
        temporaryPassword: result.temporaryPassword ?? null,
      });
      toast.success("Aluno externo criado, assinatura ativada e carteira do professor creditada.");
      setForm((current) => ({
        ...current,
        fullName: "",
        email: "",
        cpf: "",
        age: "",
        paidAmount: "",
        paymentReference: "",
        note: "",
      }));
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel criar o aluno.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
      <form onSubmit={submit} className="rounded-xl border border-border bg-white p-4">
        <SectionTitle icon={UserPlus} title="Aluno pago por fora" />
        <p className="mt-2 text-sm leading-6 text-brown-soft">
          Use quando a Diretoria receber por Pix, dinheiro, transferência ou outro caminho externo.
          O aluno fica ativo como qualquer assinante e o professor recebe o crédito na carteira.
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Field label="Nome completo">
            <Input
              value={form.fullName}
              onChange={(event) => updateForm({ fullName: event.target.value })}
              placeholder="Nome do aluno"
              required
            />
          </Field>
          <Field label="E-mail de acesso">
            <Input
              value={form.email}
              onChange={(event) => updateForm({ email: event.target.value })}
              placeholder="aluno@email.com"
              type="email"
              required
            />
          </Field>
          <Field label="CPF">
            <Input
              value={form.cpf}
              onChange={(event) => updateForm({ cpf: event.target.value })}
              placeholder="000.000.000-00"
            />
          </Field>
          <Field label="Idade">
            <Input
              value={form.age}
              onChange={(event) => updateForm({ age: event.target.value.replace(/\D/g, "") })}
              inputMode="numeric"
              placeholder="21"
            />
          </Field>
          <Field label="Idioma">
            <Input
              value={form.desiredLanguage}
              onChange={(event) => updateForm({ desiredLanguage: event.target.value })}
              placeholder="Inglês"
            />
          </Field>
          <Field label="Nível">
            <Select
              value={form.comprehensionLevel}
              onValueChange={(value) => updateForm({ comprehensionLevel: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="iniciante">Iniciante</SelectItem>
                <SelectItem value="basico">Básico</SelectItem>
                <SelectItem value="intermediario">Intermediário</SelectItem>
                <SelectItem value="avancado">Avançado</SelectItem>
                <SelectItem value="fluente">Fluente</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Professor">
            <Select
              value={form.teacherId}
              onValueChange={(value) =>
                updateForm({ teacherId: value, customPlanId: "", planMode: "platform" })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o professor" />
              </SelectTrigger>
              <SelectContent>
                {activeTeachers.length === 0 ? (
                  <SelectItem value="no-teachers" disabled>
                    Nenhum professor ativo
                  </SelectItem>
                ) : (
                  activeTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {profileById.get(teacher.id)
                        ? profileDisplayName(profileById.get(teacher.id)!)
                        : `Professor ${teacher.id.slice(0, 8)}`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Origem do plano">
            <Select
              value={form.planMode}
              onValueChange={(value) =>
                updateForm({
                  planMode: value as "platform" | "custom",
                  customPlanId: "",
                  planId: value === "platform" ? form.planId || subscriptionPlans[0]?.id || "" : "",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="platform">Planos da plataforma</SelectItem>
                <SelectItem value="custom">Plano próprio do professor</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {form.planMode === "platform" ? (
            <Field label="Plano da plataforma">
              <Select value={form.planId} onValueChange={(value) => updateForm({ planId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {subscriptionPlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {formatMoney(plan.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field label="Plano do professor">
              <Select
                value={form.customPlanId}
                onValueChange={(value) => updateForm({ customPlanId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o plano" />
                </SelectTrigger>
                <SelectContent>
                  {teacherPlans.length === 0 ? (
                    <SelectItem value="no-custom-plans" disabled>
                      Este professor nao tem planos proprios ativos
                    </SelectItem>
                  ) : (
                    teacherPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - {formatMoney(plan.price)}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
          )}

          <Field label="Valor recebido">
            <Input
              value={form.paidAmount}
              onChange={(event) => updateForm({ paidAmount: event.target.value })}
              placeholder={
                selectedPlanValue
                  ? formatMoney(selectedPlanValue).replace("R$", "").trim()
                  : "179,90"
              }
              inputMode="decimal"
            />
          </Field>
          <Field label="Referência do pagamento">
            <Input
              value={form.paymentReference}
              onChange={(event) => updateForm({ paymentReference: event.target.value })}
              placeholder="Pix, recibo ou observação curta"
            />
          </Field>
          <Field label="Início do acesso">
            <Input
              type="datetime-local"
              value={form.periodStart}
              onChange={(event) => updateForm({ periodStart: event.target.value })}
            />
          </Field>
          <Field label="Acesso até">
            <Input
              type="datetime-local"
              value={form.periodEnd}
              onChange={(event) => updateForm({ periodEnd: event.target.value })}
            />
          </Field>
        </div>

        <div className="mt-3">
          <Field label="Observação interna">
            <Textarea
              value={form.note}
              onChange={(event) => updateForm({ note: event.target.value })}
              placeholder="Ex.: aluno pagou por fora, liberar acesso e vincular ao professor."
            />
          </Field>
        </div>

        {createdAccess && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">Acesso do aluno</p>
            <p className="mt-1">E-mail: {createdAccess.email}</p>
            {createdAccess.temporaryPassword ? (
              <p>Senha temporária: {createdAccess.temporaryPassword}</p>
            ) : (
              <p>Este e-mail já existia; a senha anterior foi mantida.</p>
            )}
          </div>
        )}

        <Button
          disabled={saving}
          className="mt-5 w-full rounded-lg bg-wine text-white hover:bg-bronze"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          {saving ? "Criando e liberando..." : "Criar aluno externo e liberar acesso"}
        </Button>
      </form>

      <section className="rounded-xl border border-border bg-white p-4">
        <SectionTitle icon={Wallet} title="Como esse lançamento funciona" />
        <div className="mt-4 grid gap-3 text-sm leading-6 text-brown">
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="font-bold text-wine">1. Perfil e acesso</p>
            <p className="mt-1 text-brown-soft">
              Se o aluno não existir, a plataforma cria um acesso com senha temporária. Se já
              existir, ela reaproveita o cadastro.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="font-bold text-wine">2. Assinatura ativa</p>
            <p className="mt-1 text-brown-soft">
              O aluno entra como assinante ativo do professor escolhido e passa a aparecer nas
              mesmas áreas dos alunos pagos pela plataforma.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="font-bold text-wine">3. Carteiras</p>
            <p className="mt-1 text-brown-soft">
              O valor informado credita 90% para o professor e 10% para a carteira da plataforma. Se
              o valor ficar vazio, o sistema usa o valor do plano escolhido.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-cream p-4">
            <p className="font-bold text-wine">Atenção</p>
            <p className="mt-1 text-brown-soft">
              Para liberar por um período específico, preencha “Acesso até”. Sem essa data, a
              plataforma usa o ciclo mensal padrão do plano.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function DirectorMaterialsPanel({
  profiles,
  classes,
  roleByUser,
  materials,
  onChanged,
}: {
  profiles: Profile[];
  classes: ClassGroup[];
  roleByUser: Map<string, AppRole[]>;
  materials: ClassMaterial[];
  onChanged: () => void | Promise<void>;
}) {
  const [form, setForm] = useState(
    withTargetDefaults({
      title: "",
      description: "",
      externalUrl: "",
    }),
  );
  const [targetMode, setTargetMode] = useState<"all-teachers" | "selected-teachers">(
    "all-teachers",
  );
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const classById = useMemo(() => new Map(classes.map((item) => [item.id, item])), [classes]);
  const teacherProfiles = useMemo(
    () => profiles.filter((profile) => (roleByUser.get(profile.id) ?? []).includes("professor")),
    [profiles, roleByUser],
  );
  const baseMaterials = useMemo(
    () => materials.filter((material) => material.source === "director" && material.teacher_id),
    [materials],
  );

  const buildRows = (
    uploaded: Awaited<ReturnType<typeof uploadLearningFile>> | null,
    creatorId: string,
  ): TablesInsert<"class_materials">[] => {
    const normalizedUrl = normalizeExternalUrl(form.externalUrl);
    const base = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      external_url: normalizedUrl,
      file_path: uploaded?.path ?? null,
      file_name: uploaded?.name ?? null,
      file_mime_type: uploaded?.mimeType ?? null,
      created_by: creatorId,
    };

    const teachers =
      targetMode === "all-teachers"
        ? teacherProfiles
        : teacherProfiles.filter((profile) => selectedTeacherIds.includes(profile.id));

    if (teachers.length === 0) throw new Error("Selecione pelo menos um professor.");

    return teachers.map((profile) => ({ ...base, source: "director", teacher_id: profile.id }));
  };

  const submitMaterial = async (event: FormEvent) => {
    event.preventDefault();
    if (form.title.trim().length < 3) {
      toast.error("Informe um titulo para o material.");
      return;
    }
    if (!file && !form.externalUrl.trim()) {
      toast.error("Adicione um arquivo ou link.");
      return;
    }
    if (form.externalUrl.trim() && !normalizeExternalUrl(form.externalUrl)) {
      toast.error("Informe um link externo valido.");
      return;
    }

    setSubmitting(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      toast.error("Sessao expirada. Entre novamente.");
      return;
    }

    const uploaded = file ? await uploadLearningFile(user.id, file) : null;
    if (file && !uploaded) {
      setSubmitting(false);
      const reason = getLastLearningUploadError();
      toast.error(
        reason
          ? `Não foi possível enviar o arquivo: ${reason}`
          : "Não foi possível enviar o arquivo.",
      );
      return;
    }

    try {
      const rows = buildRows(uploaded, user.id);
      const { error } = await supabase.from("class_materials").insert(rows);
      if (error) throw error;
      toast.success("Material enviado.");
      setForm((current) => ({
        ...current,
        title: "",
        description: "",
        externalUrl: "",
      }));
      setFile(null);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nao foi possivel enviar o material.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTeacher = (teacherId: string) => {
    setSelectedTeacherIds((current) =>
      current.includes(teacherId)
        ? current.filter((id) => id !== teacherId)
        : [...current, teacherId],
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <form onSubmit={submitMaterial} className="rounded-xl border border-border bg-white p-4">
        <SectionTitle icon={Upload} title="Enviar material base pela Diretoria" />
        <p className="mt-2 text-sm text-brown-soft">
          Envie arquivos e links de apoio pedagogico para todos os professores ou selecione
          manualmente quem deve receber.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setTargetMode("all-teachers")}
            className={`rounded-xl border p-4 text-left transition ${
              targetMode === "all-teachers"
                ? "border-wine bg-wine text-white shadow-soft"
                : "border-border bg-background text-brown hover:border-bronze"
            }`}
          >
            <p className="font-bold">Todos os professores</p>
            <p className="mt-1 text-xs opacity-80">O material aparece para toda a equipe.</p>
          </button>
          <button
            type="button"
            onClick={() => setTargetMode("selected-teachers")}
            className={`rounded-xl border p-4 text-left transition ${
              targetMode === "selected-teachers"
                ? "border-wine bg-wine text-white shadow-soft"
                : "border-border bg-background text-brown hover:border-bronze"
            }`}
          >
            <p className="font-bold">Selecionar professores</p>
            <p className="mt-1 text-xs opacity-80">Escolha um ou mais professores pelo nome.</p>
          </button>
        </div>

        {targetMode === "selected-teachers" && (
          <div className="mt-4 rounded-xl border border-border bg-cream/50 p-3">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-bronze">
              Professores
            </p>
            {teacherProfiles.length === 0 ? (
              <EmptyState text="Nenhum professor cadastrado ainda." />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {teacherProfiles.map((teacher) => {
                  const selected = selectedTeacherIds.includes(teacher.id);
                  return (
                    <button
                      key={teacher.id}
                      type="button"
                      onClick={() => toggleTeacher(teacher.id)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                        selected
                          ? "border-wine bg-white text-wine shadow-sm"
                          : "border-border bg-white/70 text-brown hover:border-bronze"
                      }`}
                    >
                      <span className="font-semibold">{teacher.full_name}</span>
                      <span className="mt-0.5 block truncate text-xs text-brown-soft">
                        {teacher.email}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 grid gap-3">
          <Field label="Titulo">
            <Input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Ex.: Material complementar da semana"
            />
          </Field>
          <Field label="Descricao">
            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Explique como o material deve ser usado."
            />
          </Field>
          <Field label="Arquivo PDF">
            <Input
              type="file"
              accept={LEARNING_FILE_ACCEPT}
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </Field>
          <Field label="Link externo">
            <Input
              value={form.externalUrl}
              onChange={(event) =>
                setForm((current) => ({ ...current, externalUrl: event.target.value }))
              }
              placeholder="https://..."
            />
          </Field>
          <Button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-wine text-white hover:bg-bronze"
          >
            <Upload className="mr-2 h-4 w-4" />
            {submitting ? "Enviando..." : "Enviar material base"}
          </Button>
        </div>
      </form>

      <section className="rounded-xl border border-border bg-white p-4">
        <SectionTitle icon={FileText} title="Materiais base recentes" />
        <div className="mt-4 space-y-3">
          {baseMaterials.length === 0 ? (
            <EmptyState text="Nenhum material base enviado ainda." />
          ) : (
            baseMaterials.slice(0, 14).map((material) => (
              <div key={material.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-bold text-wine">{material.title}</p>
                    <p className="mt-1 text-xs text-brown-soft">
                      {materialTargetLabel(material, profiles, classById)} -{" "}
                      {new Date(material.created_at).toLocaleString("pt-BR")}
                    </p>
                    {material.description && (
                      <p className="mt-2 text-sm text-brown">{material.description}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="w-fit rounded-full bg-white">
                    {material.file_name ? "Arquivo" : "Link"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function DirectorCouponsPanel({
  coupons,
  redemptions,
  profiles,
  onChanged,
}: {
  coupons: DiscountCoupon[];
  redemptions: CouponRedemption[];
  profiles: Profile[];
  onChanged: () => void | Promise<void>;
}) {
  const [prefix, setPrefix] = useState("GWLF");
  const [percent, setPercent] = useState("10");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const statsByCoupon = useMemo(() => {
    const map = new Map<string, { created: number; paid: number }>();
    redemptions.forEach((redemption) => {
      const current = map.get(redemption.coupon_id) ?? { created: 0, paid: 0 };
      current.created += 1;
      if (redemption.status === "paid") current.paid += 1;
      map.set(redemption.coupon_id, current);
    });
    return map;
  }, [redemptions]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createDirectorCoupon({
        data: {
          prefix,
          discountPercent: Number(percent),
          active,
          title: `Cupom da diretoria ${Number(percent)}%`,
        },
      });
      toast.success("Cupom criado para a diretoria.");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel criar o cupom.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="rounded-xl border border-border bg-white p-4">
        <SectionTitle icon={Sparkles} title="Criar cupom da diretoria" />
        <p className="mt-2 text-sm leading-6 text-brown-soft">
          O codigo usa 4 letras e 2 numeros. Os numeros acompanham a porcentagem escolhida para o
          desconto, por exemplo GWLF10.
        </p>
        <form onSubmit={submit} className="mt-5 grid gap-3">
          <Field label="4 letras do cupom">
            <Input
              value={prefix}
              onChange={(event) =>
                setPrefix(
                  event.target.value
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-zA-Z]/g, "")
                    .toUpperCase()
                    .slice(0, 4),
                )
              }
              placeholder="GWLF"
              maxLength={4}
            />
          </Field>
          <Field label="Desconto (%)">
            <Input
              value={percent}
              onChange={(event) => setPercent(event.target.value.replace(/\D/g, "").slice(0, 2))}
              inputMode="numeric"
              placeholder="10"
            />
          </Field>
          <Button
            type="button"
            variant={active ? "default" : "outline"}
            onClick={() => setActive((value) => !value)}
            className={active ? "bg-emerald-700 text-white hover:bg-emerald-800" : ""}
          >
            {active ? "Cupom ativo" : "Cupom pausado"}
          </Button>
          <Button disabled={saving} className="rounded-lg bg-wine text-white hover:bg-bronze">
            <Sparkles className="mr-2 h-4 w-4" />
            {saving
              ? "Salvando..."
              : `Criar ${prefix}${String(Number(percent || 0)).padStart(2, "0")}`}
          </Button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <SectionTitle icon={Sparkles} title="Cupons e conversoes" />
        <div className="mt-4 space-y-3">
          {coupons.length === 0 ? (
            <EmptyState text="Nenhum cupom criado ainda." />
          ) : (
            coupons.map((coupon) => {
              const stats = statsByCoupon.get(coupon.id) ?? { created: 0, paid: 0 };
              return (
                <article
                  key={coupon.id}
                  className="rounded-xl border border-border bg-background p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-2xl font-bold text-wine">{coupon.code}</p>
                        <Badge
                          className={
                            coupon.active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-zinc-100 text-zinc-700"
                          }
                        >
                          {coupon.active ? "Ativo" : "Pausado"}
                        </Badge>
                        <Badge variant="outline">
                          {coupon.scope === "teacher" ? "Professor" : "Diretoria"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-brown-soft">
                        {coupon.discount_percent}% de desconto
                        {coupon.teacher_id ? ` - ${userName(coupon.teacher_id, profiles)}` : ""}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center sm:w-44">
                      <Info label="Checkouts" value={stats.created} />
                      <Info label="Pagos" value={stats.paid} />
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function DirectorWalletPanel({
  summary,
  transactions,
  teacherWithdrawals,
  teacherWalletTransactions,
  teacherPayoutProfiles,
  profiles,
  teachers,
  range,
  onRangeChange,
  onChanged,
}: {
  summary: PlatformWalletSummary;
  transactions: PlatformWalletTransaction[];
  teacherWithdrawals: TeacherWithdrawalRequest[];
  teacherWalletTransactions: TeacherWalletTransaction[];
  teacherPayoutProfiles: TeacherPayoutProfile[];
  profiles: Profile[];
  teachers: TeacherProfile[];
  range: PlatformRange;
  onRangeChange: Dispatch<SetStateAction<PlatformRange>>;
  onChanged: () => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const series = summary.ranges[range] ?? [];
  const periodFees = series.reduce((sum, item) => sum + item.platformFees, 0);
  const periodStudents = series.reduce((sum, item) => sum + item.studentSignups, 0);
  const availableBalance = Number(summary.availableBalance || 0);
  const pendingTeacherWithdrawals = teacherWithdrawals.filter((item) =>
    ["pendente", "em_processamento"].includes(item.status),
  );

  const submitWithdrawal = async (event: FormEvent) => {
    event.preventDefault();
    const parsedAmount = parseMoney(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    if (parsedAmount > availableBalance) {
      toast.error("Valor maior que o saldo disponível da plataforma.");
      return;
    }

    if (accountHolderName.trim().length < 2 || pixKey.trim().length < 3) {
      toast.error("Preencha o nome completo e a chave Pix.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestDirectorWithdrawal({
        data: {
          amount: parsedAmount,
          accountHolderName: accountHolderName.trim(),
          pixKey: pixKey.trim(),
          note: null,
        },
      });
      toast.success(
        result.queued
          ? "Saque da diretoria registrado para transferencia manual."
          : "Saque da diretoria registrado.",
      );
      setAmount("");
      setAccountHolderName("");
      setPixKey("");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar o saque.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DirectorWalletStat
          icon={Banknote}
          label="Valor total pela plataforma"
          value={formatMoney(summary.totalPlatformFees)}
          detail="Somatório das taxas recebidas"
        />
        <DirectorWalletStat
          icon={Wallet}
          label="Saldo da diretoria"
          value={formatMoney(summary.availableBalance)}
          detail="Disponível para saque"
          strong
        />
        <DirectorWalletStat
          icon={Send}
          label="Saques da diretoria"
          value={formatMoney(summary.totalWithdrawn)}
          detail="Total já retirado"
        />
        <DirectorWalletStat
          icon={History}
          label="Movimentos"
          value={summary.transactionsCount}
          detail="Lançamentos no extrato"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <section className="rounded-xl border border-border bg-white p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <SectionTitle icon={BarChart3} title="Valores e alunos cadastrados" />
              <p className="mt-1 text-sm text-brown-soft">
                Acompanhe taxa da plataforma e novos alunos por período.
              </p>
            </div>
            <div className="flex rounded-lg border border-border bg-background p-1">
              {(Object.keys(platformRangeLabels) as PlatformRange[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onRangeChange(item)}
                  className={`rounded-md px-3 py-2 text-xs font-bold transition ${
                    item === range ? "bg-wine text-white shadow-soft" : "text-brown-soft"
                  }`}
                >
                  {platformRangeLabels[item]}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="Taxas no período" value={formatMoney(periodFees)} />
            <Info label="Alunos cadastrados no período" value={periodStudents} />
          </div>

          <MetricBars data={series} />
        </section>

        <section className="rounded-xl border border-border bg-white p-4">
          <SectionTitle icon={CreditCard} title="Planos mais assinados" />
          <div className="mt-4 space-y-3">
            {summary.planRanking.length === 0 ? (
              <EmptyState text="Nenhum plano assinado ainda." />
            ) : (
              summary.planRanking
                .slice(0, 5)
                .map((plan, index) => (
                  <PlanRankingItem
                    key={plan.planId}
                    plan={plan}
                    index={index}
                    max={summary.planRanking[0]?.subscriptions ?? 1}
                  />
                ))
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={submitWithdrawal} className="rounded-xl border border-border bg-white p-4">
          <SectionTitle icon={LineChart} title="Saque da plataforma" />
          <p className="mt-2 text-sm text-brown-soft">
            Informe o nome completo, a chave Pix e o valor que deseja sacar da carteira da
            plataforma.
          </p>

          <div className="mt-4 grid gap-3">
            <Field label="Nome completo">
              <Input
                value={accountHolderName}
                onChange={(event) => setAccountHolderName(event.target.value)}
                placeholder="Nome da titular da chave Pix"
              />
            </Field>
            <Field label="Chave Pix">
              <Input
                value={pixKey}
                onChange={(event) => setPixKey(event.target.value)}
                placeholder="CPF, e-mail, telefone ou chave aleatória"
              />
            </Field>
            <Field label="Valor que deseja sacar">
              <Input
                inputMode="decimal"
                placeholder="Ex.: 250,00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </Field>
            <Button
              type="submit"
              disabled={submitting || availableBalance <= 0}
              className="rounded-lg bg-wine text-white hover:bg-bronze"
            >
              <Send className="mr-2 h-4 w-4" />
              {submitting ? "Sacando..." : "Sacar"}
            </Button>
          </div>
        </form>

        <section className="rounded-xl border border-border bg-white p-4">
          <SectionTitle icon={History} title="Extrato da plataforma" />
          <div className="mt-4 space-y-3">
            {transactions.length === 0 ? (
              <EmptyState text="Nenhum movimento na carteira da plataforma." />
            ) : (
              transactions.slice(0, 12).map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-bold text-wine">{platformTransactionLabel(item)}</p>
                    <p className="mt-1 text-xs text-brown-soft">
                      {new Date(item.created_at).toLocaleString("pt-BR")}
                    </p>
                    <p className="mt-2 text-sm text-brown">{item.description}</p>
                  </div>
                  <p
                    className={`shrink-0 text-lg font-bold ${
                      Number(item.amount) >= 0 ? "text-emerald-700" : "text-wine"
                    }`}
                  >
                    {Number(item.amount) >= 0 ? "+" : "-"}
                    {formatMoney(Math.abs(Number(item.amount)))}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <TeacherWithdrawalQueue
        withdrawals={teacherWithdrawals}
        pendingCount={pendingTeacherWithdrawals.length}
        walletTransactions={teacherWalletTransactions}
        payoutProfiles={teacherPayoutProfiles}
        profiles={profiles}
        teachers={teachers}
        onChanged={onChanged}
      />
    </div>
  );
}

function TeacherWithdrawalQueue({
  withdrawals,
  pendingCount,
  walletTransactions,
  payoutProfiles,
  profiles,
  teachers,
  onChanged,
}: {
  withdrawals: TeacherWithdrawalRequest[];
  pendingCount: number;
  walletTransactions: TeacherWalletTransaction[];
  payoutProfiles: TeacherPayoutProfile[];
  profiles: Profile[];
  teachers: TeacherProfile[];
  onChanged: () => void | Promise<void>;
}) {
  const profileById = useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles]);
  const teacherById = useMemo(() => new Map(teachers.map((item) => [item.id, item])), [teachers]);
  const payoutByTeacher = useMemo(
    () => new Map(payoutProfiles.map((item) => [item.teacher_id, item])),
    [payoutProfiles],
  );
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const confirmWithdrawal = async (withdrawalId: string) => {
    setConfirmingId(withdrawalId);
    try {
      await confirmTeacherWithdrawal({ data: { withdrawalId } });
      toast.success("Saque confirmado e marcado como pago.");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel confirmar o saque.");
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-white p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <SectionTitle icon={Wallet} title="Saques solicitados por professores" />
          <p className="mt-1 text-sm text-brown-soft">
            A Diretoria acompanha o pedido, os dados Pix e o saldo do professor antes da
            transferencia manual.
          </p>
        </div>
        <Badge className="w-fit rounded-full bg-wine text-white">{pendingCount} em aberto</Badge>
      </div>

      <div className="mt-4 space-y-3">
        {withdrawals.length === 0 ? (
          <EmptyState text="Nenhum saque de professor solicitado." />
        ) : (
          withdrawals.slice(0, 16).map((withdrawal) => {
            const profile = profileById.get(withdrawal.teacher_id);
            const teacher = teacherById.get(withdrawal.teacher_id);
            const payoutProfile = payoutByTeacher.get(withdrawal.teacher_id);
            const summary = teacherFinancialSummary(
              withdrawal.teacher_id,
              walletTransactions,
              withdrawals,
            );

            return (
              <div
                key={withdrawal.id}
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl font-bold text-wine">
                        {profile ? profileDisplayName(profile) : "Professor"}
                      </h3>
                      <Badge variant="outline" className="rounded-full bg-white">
                        {teacherWithdrawalStatusLabel(withdrawal.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-brown-soft">
                      Pedido em {new Date(withdrawal.requested_at).toLocaleString("pt-BR")} - ID{" "}
                      {withdrawal.id.slice(0, 8)}
                    </p>
                    <div className="mt-3 grid gap-2 text-sm text-brown sm:grid-cols-2 xl:grid-cols-4">
                      <Info label="Valor solicitado" value={formatMoney(withdrawal.amount)} />
                      <Info label="Saldo disponivel agora" value={formatMoney(summary.available)} />
                      <Info label="Reservado em saques" value={formatMoney(summary.pending)} />
                      <Info label="Total recebido" value={formatMoney(summary.received)} />
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-white p-3 text-sm text-brown lg:w-80">
                    <p className="font-bold text-wine">Dados para transferencia</p>
                    <p className="mt-2">
                      <span className="font-semibold">Nome:</span> {withdrawal.account_holder_name}
                    </p>
                    <p>
                      <span className="font-semibold">CPF:</span>{" "}
                      {withdrawal.account_holder_document || profile?.cpf || "Nao informado"}
                    </p>
                    <p>
                      <span className="font-semibold">Pix:</span> {withdrawal.pix_key}
                    </p>
                    <p>
                      <span className="font-semibold">Tipo:</span> {withdrawal.pix_key_type}
                    </p>
                    {profile?.email && (
                      <p className="mt-2 text-xs text-brown-soft">{profile.email}</p>
                    )}
                    {teacher && (
                      <p className="mt-1 text-xs text-brown-soft">
                        Idiomas: {(teacher.languages_taught || []).join(", ") || "Nao informado"}
                      </p>
                    )}
                    {payoutProfile && payoutProfile.pix_key !== withdrawal.pix_key && (
                      <p className="mt-2 rounded-lg bg-cream px-3 py-2 text-xs text-brown">
                        Pix salvo no cadastro: {payoutProfile.pix_key}
                      </p>
                    )}
                    {["pendente", "em_processamento"].includes(withdrawal.status) && (
                      <Button
                        type="button"
                        onClick={() => confirmWithdrawal(withdrawal.id)}
                        disabled={confirmingId === withdrawal.id}
                        className="mt-3 w-full rounded-lg bg-wine text-white hover:bg-bronze"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {confirmingId === withdrawal.id ? "Confirmando..." : "Confirmar saque"}
                      </Button>
                    )}
                  </div>
                </div>
                {withdrawal.payout_error && (
                  <p className="mt-3 rounded-lg bg-cream px-3 py-2 text-xs text-brown">
                    Observacao: {withdrawal.payout_error}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function DirectorWalletStat({
  icon: Icon,
  label,
  value,
  detail,
  strong,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-soft ${
        strong ? "border-wine bg-wine text-white" : "border-border bg-white"
      }`}
    >
      <Icon className={`mb-3 h-5 w-5 ${strong ? "text-bronze" : "text-bronze"}`} />
      <p className={`font-display text-2xl font-bold ${strong ? "text-white" : "text-wine"}`}>
        {value}
      </p>
      <p className={`mt-1 text-sm font-semibold ${strong ? "text-white/85" : "text-brown"}`}>
        {label}
      </p>
      <p className={`mt-1 text-xs ${strong ? "text-white/65" : "text-brown-soft"}`}>{detail}</p>
    </div>
  );
}

function MetricBars({ data }: { data: PlatformChartPoint[] }) {
  const maxFees = Math.max(...data.map((item) => item.platformFees), 1);
  const maxStudents = Math.max(...data.map((item) => item.studentSignups), 1);

  if (data.length === 0) {
    return <EmptyState text="Sem dados suficientes para o gráfico." />;
  }

  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-background p-4">
      <div className="mb-4 flex flex-wrap gap-3 text-xs font-semibold text-brown-soft">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-wine" />
          Taxas da plataforma
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-bronze" />
          Alunos cadastrados
        </span>
      </div>
      <div className="flex h-56 min-w-[560px] items-end gap-3">
        {data.map((item) => {
          const feeHeight =
            item.platformFees > 0 ? Math.max(8, (item.platformFees / maxFees) * 100) : 4;
          const studentHeight =
            item.studentSignups > 0 ? Math.max(8, (item.studentSignups / maxStudents) * 100) : 4;

          return (
            <div key={item.periodStart} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex h-44 w-full items-end justify-center gap-1.5">
                <div
                  className={`w-4 rounded-t-md ${item.platformFees > 0 ? "bg-wine" : "bg-border"}`}
                  style={{ height: `${feeHeight}%` }}
                  title={`${item.label}: ${formatMoney(item.platformFees)}`}
                />
                <div
                  className={`w-4 rounded-t-md ${item.studentSignups > 0 ? "bg-bronze" : "bg-border"}`}
                  style={{ height: `${studentHeight}%` }}
                  title={`${item.label}: ${item.studentSignups} alunos`}
                />
              </div>
              <p className="mt-2 whitespace-nowrap text-[11px] font-semibold text-brown-soft">
                {item.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanRankingItem({
  plan,
  index,
  max,
}: {
  plan: PlatformPlanRanking;
  index: number;
  max: number;
}) {
  const width = Math.max(8, (plan.subscriptions / Math.max(max, 1)) * 100);

  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-wine">
            #{index + 1} {plan.planName}
          </p>
          <p className="mt-1 text-xs text-brown-soft">
            {plan.subscriptions} assinatura{plan.subscriptions === 1 ? "" : "s"} •{" "}
            {formatMoney(plan.platformFees)} em taxa
          </p>
        </div>
        <TrendingUp className="h-4 w-4 shrink-0 text-bronze" />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-border">
        <div className="h-full rounded-full bg-gradient-warm" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-2 text-xs text-brown-soft">Receita estimada: {formatMoney(plan.revenue)}</p>
    </div>
  );
}

function withTargetDefaults<T extends Record<string, unknown>>(extra: T): T & TargetForm {
  return {
    targetType: "all",
    targetRole: "aluno",
    targetUserId: "",
    targetClassId: "",
    ...extra,
  };
}

function targetPayload(form: TargetForm) {
  return {
    targetType: form.targetType,
    targetRole: form.targetType === "role" ? form.targetRole : null,
    targetUserId: form.targetType === "user" ? form.targetUserId : null,
    targetClassId: form.targetType === "class" ? form.targetClassId : null,
  };
}

function targetLabel(
  item: Pick<
    DirectorMessage | DirectorAlert,
    "target_type" | "target_role" | "target_user_id" | "target_class_id"
  >,
  profiles: Profile[],
  classById: Map<string, ClassGroup>,
) {
  if (item.target_type === "all") return "Todos os usuários";
  if (item.target_type === "role" && item.target_role) return roleLabels[item.target_role];
  if (item.target_type === "user" && item.target_user_id)
    return userName(item.target_user_id, profiles);
  if (item.target_type === "class" && item.target_class_id)
    return classById.get(item.target_class_id)?.name ?? "Turma";
  return "Destino não definido";
}

function userName(userId: string, profiles: Profile[]) {
  const profile = profiles.find((item) => item.id === userId);
  return profile ? profileDisplayName(profile) : userId.slice(0, 8);
}

function materialTargetLabel(
  material: Pick<ClassMaterial, "source" | "teacher_id" | "student_id" | "class_id">,
  profiles: Profile[],
  classById: Map<string, ClassGroup>,
) {
  if (material.source === "platform") return "Todos os usuarios";
  if (material.class_id) return classById.get(material.class_id)?.name ?? "Turma";
  if (material.teacher_id) return `Professor: ${userName(material.teacher_id, profiles)}`;
  if (material.student_id) return `Aluno: ${userName(material.student_id, profiles)}`;
  return "Destino especifico";
}

function normalizeAdminDashboard(data: Awaited<ReturnType<typeof getAdminDashboard>> | undefined) {
  return {
    profiles: data?.profiles ?? [],
    roles: data?.roles ?? [],
    teachers: data?.teachers ?? [],
    students: data?.students ?? [],
    bookings: data?.bookings ?? [],
    classes: data?.classes ?? [],
    directorMessages: data?.directorMessages ?? [],
    directorAlerts: data?.directorAlerts ?? [],
    directMessages: data?.directMessages ?? [],
    anonymousReports: data?.anonymousReports ?? [],
    subscriptions: data?.subscriptions ?? [],
    platformWalletTransactions: data?.platformWalletTransactions ?? [],
    teacherWalletTransactions: data?.teacherWalletTransactions ?? [],
    teacherWithdrawals: data?.teacherWithdrawals ?? [],
    teacherPayoutProfiles: data?.teacherPayoutProfiles ?? [],
    classMaterials: data?.classMaterials ?? [],
    subscriptionPlans: data?.subscriptionPlans ?? [],
    teacherCustomPlans: data?.teacherCustomPlans ?? [],
    discountCoupons: data?.discountCoupons ?? [],
    couponRedemptions: data?.couponRedemptions ?? [],
    platformWalletSummary: data?.platformWalletSummary ?? emptyPlatformWalletSummary,
  };
}

function profileDisplayName(profile: Pick<Profile, "full_name" | "email" | "id">) {
  return profile.full_name?.trim() || profile.email?.trim() || `Usuário ${profile.id.slice(0, 8)}`;
}

function profileSearchText(profile: Pick<Profile, "full_name" | "email" | "id">) {
  return `${profileDisplayName(profile)} ${profile.email ?? ""}`.toLowerCase();
}

function subscriptionStatusLabel(status: string | null | undefined) {
  if (!status) return "Sem assinatura";
  return subscriptionStatusLabels[status] ?? status;
}

function subscriptionStatusClass(status: string | null | undefined) {
  if (!status) return "border-border bg-white text-brown-soft";
  return subscriptionStatusClasses[status] ?? "border-border bg-white text-brown";
}

function subscriptionPackageLabel(packageType: string | null | undefined) {
  if (packageType === "semestral") return "Semestral";
  if (packageType === "anual") return "Anual";
  return "Mensal";
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

function platformTransactionLabel(item: PlatformWalletTransaction) {
  if (item.transaction_type === "subscription_fee") return "Taxa da plataforma";
  if (item.transaction_type === "manual_adjustment" && Number(item.amount) < 0) {
    return "Saque da diretoria";
  }
  if (item.transaction_type === "manual_adjustment") return "Ajuste manual";
  return item.transaction_type;
}

function teacherWithdrawalStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    em_processamento: "Em processamento",
    pago: "Pago",
    falhou: "Falhou",
    cancelado: "Cancelado",
  };
  return labels[status] ?? status;
}

function teacherFinancialSummary(
  teacherId: string,
  walletTransactions: TeacherWalletTransaction[],
  withdrawals: TeacherWithdrawalRequest[],
) {
  const transactions = walletTransactions.filter((item) => item.teacher_id === teacherId);
  const available = transactions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const received = transactions
    .filter((item) => Number(item.amount) > 0)
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pending = withdrawals
    .filter(
      (item) =>
        item.teacher_id === teacherId && ["pendente", "em_processamento"].includes(item.status),
    )
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const withdrawn = withdrawals
    .filter((item) => item.teacher_id === teacherId && item.status === "pago")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  return {
    available,
    received,
    pending,
    withdrawn,
  };
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="gw-stat-card rounded-xl p-4">
      <Icon className="mb-2 h-5 w-5 text-bronze" />
      <p className="font-display text-2xl font-bold text-wine">{value}</p>
      <p className="mt-1 text-xs text-brown-soft">{label}</p>
    </div>
  );
}

function Tab({ value, icon: Icon, label }: { value: string; icon: LucideIcon; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className="gw-tab-trigger gap-2 rounded-lg data-[state=active]:bg-wine data-[state=active]:text-white"
    >
      <Icon className="h-4 w-4" />
      {label}
    </TabsTrigger>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-bold uppercase tracking-wide text-brown-soft">{label}</Label>
      {children}
    </div>
  );
}

function TargetControls<T extends TargetForm>({
  form,
  onChange,
  profiles,
  classes,
  roleByUser,
}: {
  form: T;
  onChange: Dispatch<SetStateAction<T>>;
  profiles: Profile[];
  classes: ClassGroup[];
  roleByUser: Map<string, AppRole[]>;
}) {
  const targetableUsers = profiles.filter((profile) => {
    const roles = roleByUser.get(profile.id) ?? [];
    return roles.includes("professor") || roles.includes("aluno");
  });

  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Field label="Destino">
        <Select
          value={form.targetType}
          onValueChange={(value) =>
            onChange((current) => ({ ...current, targetType: value as TargetType }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Para todos</SelectItem>
            <SelectItem value="role">Para professor / para aluno</SelectItem>
            <SelectItem value="user">Usuario especifico</SelectItem>
            <SelectItem value="class">Para turma</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {form.targetType === "role" && (
        <Field label="Perfil">
          <Select
            value={form.targetRole}
            onValueChange={(value) =>
              onChange((current) => ({ ...current, targetRole: value as AppRole }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aluno">Para alunos</SelectItem>
              <SelectItem value="professor">Para professores</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}

      {form.targetType === "user" && (
        <Field label="Usuário">
          <Select
            value={form.targetUserId}
            onValueChange={(value) => onChange((current) => ({ ...current, targetUserId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {targetableUsers.length === 0 ? (
                <SelectItem value="no-users" disabled>
                  Nenhum usuario encontrado
                </SelectItem>
              ) : (
                targetableUsers.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profileDisplayName(profile)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>
      )}

      {form.targetType === "class" && (
        <Field label="Turma">
          <Select
            value={form.targetClassId}
            onValueChange={(value) => onChange((current) => ({ ...current, targetClassId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {classes.length === 0 ? (
                <SelectItem value="no-classes" disabled>
                  Nenhuma turma encontrada
                </SelectItem>
              ) : (
                classes.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>
      )}
    </div>
  );
}

function ArticleItem({
  title,
  meta,
  body,
  date,
  urgent,
}: {
  title: string;
  meta: string;
  body: string;
  date: string;
  urgent?: boolean;
}) {
  return (
    <article
      className={`rounded-xl border p-3 ${urgent ? "border-wine/40 bg-rose-50" : "border-border bg-background"}`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-bold text-wine">{title}</h3>
          <p className="mt-1 text-xs text-brown-soft">{meta}</p>
        </div>
        <p className="text-xs text-brown-soft">{new Date(date).toLocaleString("pt-BR")}</p>
      </div>
      <p className="mt-2 text-sm text-brown">{body}</p>
    </article>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-xs uppercase tracking-wide text-brown-soft">{label}</p>
      <p className="mt-1 text-sm font-semibold text-brown">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-background p-6 text-center text-sm text-brown-soft">
      {text}
    </p>
  );
}

function ProfileAvatar({
  profile,
  size = "md",
}: {
  profile: Pick<Profile, "full_name" | "email" | "id" | "avatar_url">;
  size?: "sm" | "md";
}) {
  const classes = size === "sm" ? "h-10 w-10 rounded-xl text-sm" : "h-16 w-16 rounded-2xl text-xl";
  const avatarUrl = getProfileAvatarUrl(profile);

  return (
    <div
      className={`gw-avatar-frame flex shrink-0 items-center justify-center overflow-hidden ${classes}`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={profileDisplayName(profile)}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="font-bold text-wine">{profileDisplayName(profile).charAt(0)}</span>
      )}
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) return <EmptyState text="Sem registros." />;
  return (
    <table className="w-full min-w-[720px] text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          {headers.map((header) => (
            <th key={header} className="px-3 py-2 font-semibold text-wine">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index} className="border-b border-border/60">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="px-3 py-2 text-brown">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
