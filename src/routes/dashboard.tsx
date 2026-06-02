import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BadgeCheck,
  Banknote,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  FolderOpen,
  GraduationCap,
  History,
  Link as LinkIcon,
  Megaphone,
  MessageCircle,
  PencilLine,
  Plus,
  Send,
  Sparkles,
  Upload,
  UserPlus,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AvailabilityManager } from "@/components/AvailabilityManager";
import { MeetingLinkEditor } from "@/components/MeetingLinkEditor";
import { requestTeacherWithdrawal } from "@/functions/wallet.functions";
import { upsertTeacherCoupon } from "@/functions/coupon.functions";
import { LANGUAGES, LEVELS, WEEKDAYS } from "@/lib/constants";
import { normalizeExternalUrl } from "@/lib/resource-links";
import {
  LEARNING_FILE_ACCEPT,
  getLastLearningOpenError,
  getLastLearningUploadError,
  openLearningFile,
  uploadLearningFile,
} from "@/lib/upload";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard - GWLanguageFlow" }] }),
  component: () => (
    <RequireAuth allow={["professor", "dev"]}>
      <DashboardPage />
    </RequireAuth>
  ),
});

type Booking = Tables<"bookings">;
type ClassGroup = Tables<"class_groups">;
type ClassMember = Tables<"class_members">;
type ClassMaterial = Tables<"class_materials">;
type ClassAssignment = Tables<"class_assignments">;
type StudentScore = Tables<"student_scores">;
type StudentMessage = Tables<"teacher_student_messages">;
type MaterialRequest = Tables<"material_requests">;
type SecretariatMessage = Tables<"teacher_secretariat_messages">;
type TeacherAnnouncement = Tables<"teacher_announcements">;
type TeacherMeeting = Tables<"teacher_meetings">;
type WalletTransaction = Tables<"teacher_wallet_transactions">;
type WithdrawalRequest = Tables<"teacher_withdrawal_requests">;
type DiscountCoupon = Tables<"discount_coupons">;
type TeacherProfileRecord = Pick<
  Tables<"teacher_profiles">,
  "languages_taught" | "use_custom_pricing"
>;
type TeacherPayoutProfile = Pick<
  Tables<"teacher_payout_profiles">,
  "pix_key" | "account_holder_name" | "account_holder_document"
>;
type TeacherIdentity = Pick<Tables<"profiles">, "full_name" | "cpf">;
type TeacherStudentSubscription = Pick<Tables<"student_subscriptions">, "student_id" | "status">;

type StudentProfile = Pick<Tables<"profiles">, "id" | "full_name" | "avatar_url"> & {
  desired_language?: string | null;
  comprehension_level?: Tables<"student_profiles">["comprehension_level"] | null;
};

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

const TEACHER_GUIDE_VIDEO_SRC = "/videos/guia-professor.mp4";
const TEACHER_GUIDE_POSTER_SRC = "/videos/guia-professor-poster.jpg";

type TeacherGuideVideoStatus = "checking" | "available" | "missing";
type TeacherGuideIntroState = "checking" | "show" | "hide";

function teacherGuideSeenKey(userId: string) {
  return `gwl:teacher-guide-seen:${userId}`;
}

function readTeacherGuideSeen(userId: string) {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(teacherGuideSeenKey(userId)) === "true";
  } catch {
    return true;
  }
}

function markTeacherGuideSeen(userId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(teacherGuideSeenKey(userId), "true");
  } catch {
    // If storage is blocked, do not prevent the teacher from entering the dashboard.
  }
}

function useTeacherGuideVideoStatus() {
  const [status, setStatus] = useState<TeacherGuideVideoStatus>("checking");

  useEffect(() => {
    let active = true;

    fetch(TEACHER_GUIDE_VIDEO_SRC, { method: "HEAD", cache: "no-store" })
      .then((response) => {
        if (active) setStatus(response.ok ? "available" : "missing");
      })
      .catch(() => {
        if (active) setStatus("missing");
      });

    return () => {
      active = false;
    };
  }, []);

  return status;
}

function DashboardPage() {
  const { user } = useAuth();
  const guideVideoStatus = useTeacherGuideVideoStatus();
  const [guideIntroState, setGuideIntroState] = useState<TeacherGuideIntroState>("checking");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [students, setStudents] = useState<StudentProfile[]>([]);
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfileRecord | null>(null);
  const [teacherIdentity, setTeacherIdentity] = useState<TeacherIdentity | null>(null);
  const [teacherPayoutProfile, setTeacherPayoutProfile] = useState<TeacherPayoutProfile | null>(
    null,
  );
  const [pricingMode, setPricingMode] = useState<"padrao" | "custom" | null>(null);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [materials, setMaterials] = useState<ClassMaterial[]>([]);
  const [materialRequests, setMaterialRequests] = useState<MaterialRequest[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [scores, setScores] = useState<StudentScore[]>([]);
  const [messages, setMessages] = useState<StudentMessage[]>([]);
  const [secretariatMessages, setSecretariatMessages] = useState<SecretariatMessage[]>([]);
  const [announcements, setAnnouncements] = useState<TeacherAnnouncement[]>([]);
  const [meetings, setMeetings] = useState<TeacherMeeting[]>([]);
  const [walletSummary, setWalletSummary] = useState<WalletSummary>(emptyWalletSummary);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [teacherCoupon, setTeacherCoupon] = useState<DiscountCoupon | null>(null);
  const [creditingBookingId, setCreditingBookingId] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!user) return;

    const [
      { data: bks },
      { data: tp },
      { data: identity },
      { data: payoutProfile },
      { data: classRows },
      { data: materialRows },
      { data: requestRows },
      { data: assignmentRows },
      { data: scoreRows },
      { data: messageRows },
      { data: secretariatRows },
      { data: announcementRows },
      { data: meetingRows },
      { data: summary },
      { data: transactions },
      { data: withdrawalRows },
      { data: subscriptionRows },
      { data: couponRow },
    ] = await Promise.all([
      supabase
        .from("bookings")
        .select("*")
        .eq("teacher_id", user.id)
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("teacher_profiles")
        .select("languages_taught, use_custom_pricing")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("profiles").select("full_name, cpf").eq("id", user.id).maybeSingle(),
      supabase
        .from("teacher_payout_profiles")
        .select("pix_key, account_holder_name, account_holder_document")
        .eq("teacher_id", user.id)
        .maybeSingle(),
      supabase
        .from("class_groups")
        .select("*")
        .eq("teacher_id", user.id)
        .eq("status", "ativa")
        .order("created_at", { ascending: true }),
      supabase.from("class_materials").select("*").order("created_at", { ascending: false }),
      supabase
        .from("material_requests")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("class_assignments")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("student_scores")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("teacher_student_messages")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("teacher_secretariat_messages")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("teacher_announcements")
        .select("*")
        .order("published_at", { ascending: false }),
      supabase.from("teacher_meetings").select("*").order("scheduled_at", { ascending: true }),
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
      supabase
        .from("student_subscriptions")
        .select("student_id, status")
        .eq("teacher_id", user.id)
        .eq("status", "ativa"),
      supabase
        .from("discount_coupons")
        .select("*")
        .eq("teacher_id", user.id)
        .eq("scope", "teacher")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setBookings(bks || []);
    setTeacherProfile((tp as TeacherProfileRecord | null) ?? null);
    setTeacherIdentity((identity as TeacherIdentity | null) ?? null);
    setTeacherPayoutProfile((payoutProfile as TeacherPayoutProfile | null) ?? null);
    setPricingMode(tp?.use_custom_pricing ? "custom" : "padrao");
    setClasses(classRows || []);
    setMaterials(materialRows || []);
    setMaterialRequests(requestRows || []);
    setAssignments(assignmentRows || []);
    setScores(scoreRows || []);
    setMessages(messageRows || []);
    setSecretariatMessages(secretariatRows || []);
    setAnnouncements(announcementRows || []);
    setMeetings(meetingRows || []);
    setWalletSummary(summary ?? emptyWalletSummary);
    setWalletTransactions(transactions ?? []);
    setWithdrawals(withdrawalRows ?? []);
    setTeacherCoupon((couponRow as DiscountCoupon | null) ?? null);

    let memberRows: ClassMember[] = [];
    if (classRows?.length) {
      const classIds = classRows.map((item) => item.id);
      const { data } = await supabase
        .from("class_members")
        .select("*")
        .in("class_id", classIds)
        .eq("status", "ativo");
      memberRows = data || [];
      setMembers(memberRows);
    } else {
      setMembers([]);
    }

    const studentIds = Array.from(
      new Set([
        ...(bks || []).map((b) => b.student_id),
        ...memberRows.map((m) => m.student_id),
        ...((subscriptionRows || []) as TeacherStudentSubscription[]).map(
          (item) => item.student_id,
        ),
      ]),
    );

    if (studentIds.length) {
      const [{ data: profs }, { data: learningProfiles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", studentIds),
        supabase
          .from("student_profiles")
          .select("id, desired_language, comprehension_level")
          .in("id", studentIds),
      ]);
      const learningMap = new Map(learningProfiles?.map((p) => [p.id, p]) ?? []);
      setStudents(
        (profs || []).map((profile) => ({
          ...profile,
          desired_language: learningMap.get(profile.id)?.desired_language,
          comprehension_level: learningMap.get(profile.id)?.comprehension_level,
        })),
      );
    } else {
      setStudents([]);
    }
  }, [user]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!user) return;
    if (guideVideoStatus === "checking") {
      setGuideIntroState("checking");
      return;
    }
    if (guideVideoStatus !== "available") {
      setGuideIntroState("hide");
      return;
    }
    setGuideIntroState(readTeacherGuideSeen(user.id) ? "hide" : "show");
  }, [guideVideoStatus, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`teacher-live-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teacher_student_messages",
          filter: `teacher_id=eq.${user.id}`,
        },
        () => loadDashboard(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teacher_secretariat_messages",
          filter: `teacher_id=eq.${user.id}`,
        },
        () => loadDashboard(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "class_materials" }, () =>
        loadDashboard(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_assignments",
          filter: `teacher_id=eq.${user.id}`,
        },
        () => loadDashboard(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "material_requests",
          filter: `teacher_id=eq.${user.id}`,
        },
        () => loadDashboard(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teacher_withdrawal_requests",
          filter: `teacher_id=eq.${user.id}`,
        },
        () => loadDashboard(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teacher_wallet_transactions",
          filter: `teacher_id=eq.${user.id}`,
        },
        () => loadDashboard(),
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
  }, [loadDashboard, user]);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const upcoming = bookings.filter(
    (b) => new Date(b.scheduled_at) > new Date() && b.status !== "cancelado",
  );
  const classroomBookings = bookings.filter(
    (b) => b.status !== "cancelado" && b.status !== "concluido",
  );
  const completedLessons = bookings.filter((b) => b.status === "concluido").length;

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
    toast.success(
      credited > 0
        ? `Aula concluida. Credito liberado: ${formatMoney(credited)}.`
        : "Aula concluida. Assinatura ja creditada na carteira.",
    );
    await loadDashboard();
  };

  const handleGuideIntroContinue = () => {
    if (user) markTeacherGuideSeen(user.id);
    setGuideIntroState("hide");
  };

  if (guideIntroState === "checking") {
    return (
      <div className="gw-app-shell min-h-screen">
        <SiteHeader />
        <main className="container mx-auto max-w-4xl px-4 py-10">
          <div className="gw-app-card rounded-xl p-8 text-center shadow-soft">
            <Video className="mx-auto mb-4 h-8 w-8 text-bronze" />
            <p className="text-sm font-semibold text-wine">Preparando seu dashboard...</p>
          </div>
        </main>
      </div>
    );
  }

  if (guideIntroState === "show") {
    return <TeacherGuideIntro onContinue={handleGuideIntroContinue} />;
  }

  return (
    <div className="gw-app-shell min-h-screen">
      <SiteHeader />
      <main className="container mx-auto max-w-7xl px-4 py-8 md:py-10">
        <div className="gw-command-hero mb-6 flex flex-col gap-6 rounded-xl p-6 md:flex-row md:items-end md:justify-between md:p-8">
          <div>
            <p className="text-sm font-bold uppercase text-bronze">Dashboard do professor</p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-wine md:text-5xl">
              Olá, professor
            </h1>
            <p className="mt-3 max-w-2xl leading-7 text-brown-soft">
              Organize turmas, aulas, materiais, atividades, mensagens e carteira em uma central de
              operação pedagógica.
            </p>
          </div>
          {pricingMode && (
            <div
              className={`inline-flex items-center gap-3 rounded-xl border px-5 py-4 text-sm shadow-soft ${
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
                    <p className="text-[11px] text-white/70">
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

        <div className="mb-8 grid gap-4 lg:grid-cols-3">
          <Stat icon={Users} label="Alunos ativos" value={students.length} />
          <UpcomingLessonsCard
            upcoming={upcoming}
            studentMap={studentMap}
            teacherLanguages={teacherProfile?.languages_taught || []}
          />
          <Stat icon={BookOpen} label="Aulas concluídas" value={completedLessons} />
        </div>

        <Tabs defaultValue="sala" className="gw-app-card rounded-xl p-3 md:p-5">
          <TabsList className="gw-tab-list h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
            <TeacherTab value="sala" icon={Calendar} label="Sala de Aula" />
            <TeacherTab value="alunos" icon={Users} label="Meus Alunos" />
            <TeacherTab value="atividades" icon={GraduationCap} label="Atividades" />
            <TeacherTab value="secretaria" icon={MessageCircle} label="Secretaria" />
            <TeacherTab value="disponibilidade" icon={Clock} label="Disponibilidade" />
            <TeacherTab value="carteira" icon={Wallet} label="Carteira" />
            <TeacherTab value="cupom" icon={Sparkles} label="Cupom" />
            <TeacherTab value="material" icon={FolderOpen} label="Material" />
            <TeacherTab value="guia" icon={Video} label="Guia do professor" />
          </TabsList>

          <TabsContent value="sala" className="mt-6">
            <ClassroomPanel
              classes={classes}
              members={members}
              students={students}
              bookings={classroomBookings}
              studentMap={studentMap}
              onChanged={loadDashboard}
              onCompleteBooking={handleCompleteBooking}
              creditingBookingId={creditingBookingId}
              teacherId={user?.id}
            />
          </TabsContent>

          <TabsContent value="alunos" className="mt-6">
            <StudentsPanel
              classes={classes}
              members={members}
              students={students}
              bookings={bookings}
              messages={messages}
              scores={scores}
              teacherId={user?.id}
              onChanged={loadDashboard}
            />
          </TabsContent>

          <TabsContent value="atividades" className="mt-6">
            <AssignmentsPanel
              classes={classes}
              students={students}
              assignments={assignments}
              onChanged={loadDashboard}
              teacherId={user?.id}
            />
          </TabsContent>

          <TabsContent value="secretaria" className="mt-6">
            <SecretariatPanel
              teacherId={user?.id}
              announcements={announcements}
              meetings={meetings}
              messages={secretariatMessages}
              onChanged={loadDashboard}
            />
          </TabsContent>

          <TabsContent value="disponibilidade" className="mt-6">
            <AvailabilityManager />
          </TabsContent>

          <TabsContent value="carteira" className="mt-6">
            <WalletPanel
              summary={walletSummary}
              transactions={walletTransactions}
              withdrawals={withdrawals}
              teacherIdentity={teacherIdentity}
              payoutProfile={teacherPayoutProfile}
              onChanged={loadDashboard}
            />
          </TabsContent>

          <TabsContent value="cupom" className="mt-6">
            <TeacherCouponPanel
              coupon={teacherCoupon}
              teacherName={teacherIdentity?.full_name ?? ""}
              onChanged={loadDashboard}
            />
          </TabsContent>

          <TabsContent value="material" className="mt-6">
            <MaterialsPanel
              classes={classes}
              students={students}
              materials={materials}
              requests={materialRequests}
              pricingMode={pricingMode}
              teacherId={user?.id}
              onChanged={loadDashboard}
            />
          </TabsContent>

          <TabsContent value="guia" className="mt-6">
            <TeacherGuidePanel videoStatus={guideVideoStatus} />
          </TabsContent>
        </Tabs>

        <div className="mt-6 hidden text-center">
          {user && (
            <Link to="/professor/$id" params={{ id: user.id }}>
              <Button variant="outline" className="border-wine text-wine gap-2">
                <PencilLine className="h-4 w-4" />
                Editar meu perfil
              </Button>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

function TeacherGuideIntro({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="gw-app-shell min-h-screen">
      <SiteHeader />
      <main className="container mx-auto max-w-5xl px-4 py-8 md:py-12">
        <section className="gw-command-hero overflow-hidden rounded-xl shadow-bronze">
          <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 md:p-10">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-bronze">
                Guia inicial
              </p>
              <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-wine md:text-5xl">
                Bem-vindo ao painel do professor
              </h1>
              <p className="mt-4 max-w-2xl leading-7 text-brown-soft">
                Assista ao guia antes de entrar no dashboard para entender como organizar alunos,
                materiais, agenda, mensagens e carteira em um fluxo profissional.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <GuideMiniStat label="Alunos" value="centralizados" />
                <GuideMiniStat label="Materiais" value="organizados" />
                <GuideMiniStat label="Carteira" value="visivel" />
              </div>
            </div>

            <div className="border-t border-border bg-white/70 p-4 md:p-6 lg:border-l lg:border-t-0">
              <TeacherGuideVideoCard videoStatus="available" />
              <Button
                type="button"
                onClick={onContinue}
                className="mt-4 h-12 w-full bg-wine text-white shadow-bronze hover:bg-bronze"
              >
                Prosseguir para o dashboard
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function TeacherGuidePanel({ videoStatus }: { videoStatus: TeacherGuideVideoStatus }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <TeacherGuideVideoCard videoStatus={videoStatus} />

      <div className="gw-app-card rounded-xl p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-bronze" />
          <h3 className="font-display text-2xl font-bold text-wine">Guia do professor</h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-brown-soft">
          Este espaço guarda o vídeo de orientação e os pontos principais para conduzir sua rotina
          dentro da GWLanguageFlow.
        </p>

        <div className="mt-5 space-y-3">
          <GuideChecklistItem
            title="Perfil completo"
            description="Mantenha foto, banner, idiomas, bio, chave Pix e valores sempre atualizados."
          />
          <GuideChecklistItem
            title="Sala de aula organizada"
            description="Crie turmas, acompanhe alunos ativos e registre aulas concluídas."
          />
          <GuideChecklistItem
            title="Materiais e atividades"
            description="Envie arquivos, responda solicitações e acompanhe entregas dos alunos."
          />
          <GuideChecklistItem
            title="Carteira"
            description="Confira o saldo disponível e solicite saque pelo WhatsApp da plataforma."
          />
        </div>
      </div>
    </div>
  );
}

function TeacherCouponPanel({
  coupon,
  teacherName,
  onChanged,
}: {
  coupon: DiscountCoupon | null;
  teacherName: string;
  onChanged: () => void | Promise<void>;
}) {
  const [discountPercent, setDiscountPercent] = useState(String(coupon?.discount_percent ?? 10));
  const [active, setActive] = useState(coupon?.active ?? false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDiscountPercent(String(coupon?.discount_percent ?? 10));
    setActive(coupon?.active ?? false);
  }, [coupon]);

  const codePreview = `${teacherCouponPrefix(teacherName)}-${String(
    Number(discountPercent || 0),
  ).padStart(2, "0")}`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await upsertTeacherCoupon({
        data: {
          discountPercent: Number(discountPercent),
          active,
        },
      });
      toast.success(active ? "Cupom ativado no feed." : "Cupom pausado.");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar o cupom.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
      <form onSubmit={submit} className="gw-app-card gw-input-shell rounded-xl p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-bronze" />
          <h3 className="font-display text-2xl font-bold text-wine">Cupom do professor</h3>
        </div>
        <p className="mt-2 text-sm leading-6 text-brown-soft">
          Quando ativo, seu card no feed ganha destaque visual e o aluno pode aplicar o desconto
          antes de assinar com voce.
        </p>

        <div className="mt-5 grid gap-3">
          <div className="rounded-xl border border-bronze/30 bg-cream p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-brown-soft">
              Codigo previsto
            </p>
            <p className="mt-1 font-display text-3xl font-bold text-wine">{codePreview}</p>
            <p className="mt-1 text-xs text-brown-soft">
              As 4 letras saem do seu nome. Os numeros acompanham a porcentagem do desconto.
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Porcentagem de desconto</Label>
            <Input
              value={discountPercent}
              onChange={(event) =>
                setDiscountPercent(event.target.value.replace(/\D/g, "").slice(0, 2))
              }
              inputMode="numeric"
              placeholder="10"
            />
          </div>

          <Button
            type="button"
            variant={active ? "default" : "outline"}
            onClick={() => setActive((value) => !value)}
            className={active ? "bg-emerald-700 text-white hover:bg-emerald-800" : ""}
          >
            {active ? "Cupom ativo" : "Cupom pausado"}
          </Button>

          <Button disabled={saving} className="bg-wine text-white hover:bg-bronze">
            {saving ? "Salvando..." : "Salvar cupom"}
          </Button>
        </div>
      </form>

      <section className="gw-app-card rounded-xl p-5 shadow-soft">
        <h3 className="font-display text-xl font-bold text-wine">Como usar sem desvalorizar</h3>
        <div className="mt-4 space-y-3">
          <GuideChecklistItem
            title="Use como campanha"
            description="Ative em momentos especificos: abertura de agenda, semana de conversacao, volta as aulas ou quando quiser preencher poucos horarios."
          />
          <GuideChecklistItem
            title="Crie urgencia"
            description="O ideal e colocar 1 ou 2 vezes no mes. Assim o aluno percebe como uma oportunidade real, nao como preco permanente."
          />
          <GuideChecklistItem
            title="Apareca mais no feed"
            description="Enquanto estiver ativo, seu card ganha brilho e selo com a porcentagem do desconto para chamar mais atencao."
          />
        </div>
      </section>
    </div>
  );
}

function TeacherGuideVideoCard({ videoStatus }: { videoStatus: TeacherGuideVideoStatus }) {
  if (videoStatus === "checking") {
    return (
      <div className="gw-app-card flex aspect-video items-center justify-center rounded-xl p-6 text-center shadow-soft">
        <div>
          <Video className="mx-auto mb-3 h-8 w-8 text-bronze" />
          <p className="text-sm font-semibold text-wine">Carregando guia...</p>
        </div>
      </div>
    );
  }

  if (videoStatus === "missing") {
    return (
      <div className="gw-app-card flex aspect-video items-center justify-center rounded-xl border border-dashed border-bronze/50 bg-cream/60 p-6 text-center shadow-soft">
        <div>
          <Upload className="mx-auto mb-3 h-8 w-8 text-bronze" />
          <p className="font-semibold text-wine">Vídeo do guia aguardando publicação</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-brown-soft">
            Quando o arquivo do guia for enviado para a plataforma, ele aparecerá aqui e será
            exibido apenas uma vez antes do primeiro acesso ao dashboard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-black shadow-bronze">
      <video
        className="aspect-video w-full bg-black object-contain"
        controls
        playsInline
        preload="metadata"
        poster={TEACHER_GUIDE_POSTER_SRC}
      >
        <source src={TEACHER_GUIDE_VIDEO_SRC} type="video/mp4" />
        Seu navegador nao conseguiu carregar o video do guia.
      </video>
    </div>
  );
}

function GuideMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white/76 p-4 shadow-soft">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-bronze">{label}</p>
      <p className="mt-1 font-semibold text-wine">{value}</p>
    </div>
  );
}

function GuideChecklistItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border bg-white/78 p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-bronze" />
        <div>
          <p className="font-semibold text-wine">{title}</p>
          <p className="mt-1 text-sm leading-6 text-brown-soft">{description}</p>
        </div>
      </div>
    </div>
  );
}

function TeacherTab({
  value,
  icon: Icon,
  label,
}: {
  value: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <TabsTrigger value={value} className="gw-tab-trigger px-4 py-2 text-sm font-semibold">
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </TabsTrigger>
  );
}

function UpcomingLessonsCard({
  upcoming,
  studentMap,
  teacherLanguages,
}: {
  upcoming: Booking[];
  studentMap: Map<string, StudentProfile>;
  teacherLanguages: string[];
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Booking[]>();
    const languages = teacherLanguages.length ? teacherLanguages : ["Agenda"];
    languages.forEach((language) => map.set(language, []));
    upcoming.forEach((booking) => {
      const student = studentMap.get(booking.student_id);
      const language = student?.desired_language || "Agenda";
      if (!map.has(language)) map.set(language, []);
      map.get(language)?.push(booking);
    });
    return Array.from(map.entries()).filter(([, rows]) => rows.length > 0);
  }, [studentMap, teacherLanguages, upcoming]);

  return (
    <div className="gw-stat-card min-h-[138px] rounded-xl p-5">
      <Calendar className="mb-3 h-5 w-5 text-bronze" />
      <p className="text-xs text-brown-soft">Próximas aulas</p>
      {groups.length === 0 ? (
        <p className="text-sm text-brown-soft mt-4">Sem aulas próximas na agenda.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {groups.map(([language, rows]) => (
            <div key={language}>
              <p className="text-[11px] uppercase tracking-wider text-bronze font-semibold">
                Calendário de {language}
              </p>
              <div className="mt-1 space-y-1.5">
                {rows.slice(0, 2).map((booking) => {
                  const student = studentMap.get(booking.student_id);
                  return (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-wine font-medium truncate">
                        {student?.full_name || "Aluno"}
                      </span>
                      <span className="text-brown-soft whitespace-nowrap">
                        {format(new Date(booking.scheduled_at), "dd/MM HH:mm")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClassroomPanel({
  classes,
  members,
  students,
  bookings,
  studentMap,
  teacherId,
  onChanged,
  onCompleteBooking,
  creditingBookingId,
}: {
  classes: ClassGroup[];
  members: ClassMember[];
  students: StudentProfile[];
  bookings: Booking[];
  studentMap: Map<string, StudentProfile>;
  teacherId?: string;
  onChanged: () => void | Promise<void>;
  onCompleteBooking: (bookingId: string) => void;
  creditingBookingId: string | null;
}) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [level, setLevel] = useState<ClassGroup["level"]>("iniciante");
  const [day, setDay] = useState("1");
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("20:00");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [selectedStudentByClass, setSelectedStudentByClass] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const createClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId) return;
    if (name.trim().length < 3) {
      toast.error("Informe o nome da turma.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("class_groups").insert({
      teacher_id: teacherId,
      name: name.trim(),
      language,
      level,
      day_of_week: Number(day),
      start_time: startTime,
      end_time: endTime,
      meeting_url: meetingUrl.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Turma criada.");
    setName("");
    setMeetingUrl("");
    await onChanged();
  };

  const addStudentToClass = async (classId: string) => {
    const studentId = selectedStudentByClass[classId];
    if (!studentId) {
      toast.error("Escolha um aluno.");
      return;
    }
    const { error } = await supabase
      .from("class_members")
      .insert({ class_id: classId, student_id: studentId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Aluno adicionado à turma.");
    setSelectedStudentByClass((prev) => ({ ...prev, [classId]: "" }));
    await onChanged();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={createClass} className="gw-app-card gw-input-shell rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Plus className="h-5 w-5 text-bronze" />
          <h3 className="font-display text-xl text-wine">Criar turma</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 lg:col-span-2">
            <Label>Nome da turma</Label>
            <Input
              placeholder="Ex: Inglês B1 - Terça 19h"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Idioma</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nível</Label>
            <Select
              value={level || "iniciante"}
              onValueChange={(value) => setLevel(value as ClassGroup["level"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEVELS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dia</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((item, index) => (
                  <SelectItem key={item} value={String(index)}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Início</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Fim</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Link da videoaula</Label>
            <Input
              placeholder="Google Meet, Zoom..."
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
            />
          </div>
        </div>
        <Button disabled={submitting} className="mt-4 bg-bronze text-white hover:bg-wine gap-2">
          <Plus className="h-4 w-4" />
          {submitting ? "Criando..." : "Criar turma"}
        </Button>
      </form>

      {classes.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {classes.map((item) => {
            const classMembers = members.filter((member) => member.class_id === item.id);
            const classStudentIds = new Set(classMembers.map((member) => member.student_id));
            const availableStudents = students.filter(
              (student) => !classStudentIds.has(student.id),
            );
            return (
              <div key={item.id} className="gw-app-card rounded-xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl text-wine">{item.name}</h3>
                    <p className="text-sm text-brown">
                      {item.language} ·{" "}
                      {item.level
                        ? LEVELS.find((l) => l.value === item.level)?.label
                        : "Nível livre"}
                    </p>
                    <p className="text-sm text-brown-soft mt-1">{formatClassSchedule(item)}</p>
                  </div>
                  <span className="rounded-full bg-bronze/15 px-3 py-1 text-xs font-semibold text-bronze">
                    {classMembers.length} alunos
                  </span>
                </div>

                <ClassMeetingLinkEditor item={item} onChanged={onChanged} />

                <div className="rounded-xl bg-cream p-3">
                  <Label className="text-xs">Adicionar aluno à turma</Label>
                  <div className="mt-2 flex flex-col sm:flex-row gap-2">
                    <Select
                      value={selectedStudentByClass[item.id] || ""}
                      onValueChange={(value) =>
                        setSelectedStudentByClass((prev) => ({ ...prev, [item.id]: value }))
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecionar aluno" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableStudents.length === 0 ? (
                          <SelectItem value="none" disabled>
                            Todos os alunos já estão na turma
                          </SelectItem>
                        ) : (
                          availableStudents.map((student) => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.full_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-wine text-wine gap-2"
                      onClick={() => addStudentToClass(item.id)}
                    >
                      <UserPlus className="h-4 w-4" />
                      Adicionar
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-brown-soft">
                    Alunos da turma
                  </p>
                  {classMembers.length === 0 ? (
                    <p className="text-sm text-brown-soft">Nenhum aluno vinculado ainda.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {classMembers.map((member) => (
                        <span
                          key={member.id}
                          className="rounded-full bg-wine/10 px-3 py-1 text-xs text-wine"
                        >
                          {studentMap.get(member.student_id)?.full_name || "Aluno"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="gw-app-card rounded-xl p-5">
          <h3 className="font-display text-xl text-wine mb-3">Aulas agendadas sem turma criada</h3>
          {bookings.length === 0 ? (
            <Empty msg="Nenhuma aula agendada ainda." />
          ) : (
            <div className="space-y-3">
              {bookings.map((booking) => {
                const student = studentMap.get(booking.student_id);
                const canComplete = new Date(booking.scheduled_at) <= new Date();
                return (
                  <div
                    key={booking.id}
                    className="flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-xl border border-border"
                  >
                    <Avatar name={student?.full_name || "Aluno"} url={student?.avatar_url} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-wine">
                        Turma de {student?.desired_language || "idiomas"} ·{" "}
                        {student?.full_name || "Aluno"}
                      </p>
                      <p className="text-sm text-brown">
                        {format(new Date(booking.scheduled_at), "EEEE, d 'de' MMMM 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                      {booking.meeting_url && (
                        <p className="text-xs text-bronze truncate mt-1">{booking.meeting_url}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <MeetingLinkEditor
                        bookingId={booking.id}
                        initialUrl={booking.meeting_url}
                        onSaved={onChanged}
                      />
                      {canComplete && (
                        <Button
                          size="sm"
                          onClick={() => onCompleteBooking(booking.id)}
                          disabled={creditingBookingId === booking.id}
                          className="bg-wine text-white hover:bg-bronze gap-2"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {creditingBookingId === booking.id ? "Creditando..." : "Marcar concluida"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StudentsPanel({
  classes,
  members,
  students,
  bookings,
  messages,
  scores,
  teacherId,
  onChanged,
}: {
  classes: ClassGroup[];
  members: ClassMember[];
  students: StudentProfile[];
  bookings: Booking[];
  messages: StudentMessage[];
  scores: StudentScore[];
  teacherId?: string;
  onChanged: () => void | Promise<void>;
}) {
  const groups = useMemo(() => {
    if (classes.length) {
      return classes.map((item) => ({
        id: item.id,
        name: item.name,
        subtitle: `${item.language} · ${formatClassSchedule(item)}`,
        students: members
          .filter((member) => member.class_id === item.id)
          .map((member) => students.find((student) => student.id === member.student_id))
          .filter(Boolean) as StudentProfile[],
      }));
    }
    const byLanguage = new Map<string, StudentProfile[]>();
    bookings.forEach((booking) => {
      const student = students.find((item) => item.id === booking.student_id);
      if (!student) return;
      const key = student.desired_language || "Sem turma definida";
      byLanguage.set(key, [...(byLanguage.get(key) || []), student]);
    });
    return Array.from(byLanguage.entries()).map(([language, rows]) => ({
      id: language,
      name: `Turma de ${language}`,
      subtitle: "Agrupamento provisório por idioma",
      students: Array.from(new Map(rows.map((student) => [student.id, student])).values()),
    }));
  }, [bookings, classes, members, students]);

  if (!students.length) return <Empty msg="Você ainda não tem alunos." />;

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.id} className="rounded-2xl border border-border p-5">
          <div className="mb-4">
            <h3 className="font-display text-xl text-wine">{group.name}</h3>
            <p className="text-sm text-brown-soft">{group.subtitle}</p>
          </div>
          {group.students.length === 0 ? (
            <p className="text-sm text-brown-soft">Nenhum aluno vinculado nesta turma.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {group.students.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  teacherId={teacherId}
                  classId={classes.find((item) => item.id === group.id)?.id || null}
                  messages={messages.filter((message) => message.student_id === student.id)}
                  scores={scores.filter((score) => score.student_id === student.id)}
                  onChanged={onChanged}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function StudentCard({
  student,
  teacherId,
  classId,
  messages,
  scores,
  onChanged,
}: {
  student: StudentProfile;
  teacherId?: string;
  classId: string | null;
  messages: StudentMessage[];
  scores: StudentScore[];
  onChanged: () => void | Promise<void>;
}) {
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");
  const latestScore = scores[0];

  const saveScore = async () => {
    if (!teacherId) return;
    const parsed = score.trim() ? Number(score) : null;
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 10)) {
      toast.error("A nota precisa estar entre 0 e 10.");
      return;
    }
    if (parsed === null && note.trim().length < 2) {
      toast.error("Informe uma nota ou uma observação.");
      return;
    }
    const { error } = await supabase.from("student_scores").insert({
      teacher_id: teacherId,
      student_id: student.id,
      class_id: classId,
      score: parsed,
      note: note.trim() || null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Registro do aluno salvo.");
    setScore("");
    setNote("");
    await onChanged();
  };

  return (
    <div className="rounded-2xl border border-border p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={student.full_name} url={student.avatar_url} />
        <div>
          <p className="font-semibold text-wine">{student.full_name}</p>
          <p className="text-xs text-brown-soft">
            {student.desired_language || "Idioma não informado"} ·{" "}
            {student.comprehension_level
              ? LEVELS.find((item) => item.value === student.comprehension_level)?.label
              : "nível não informado"}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-cream p-3 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-wine">Pontuação e acompanhamento</p>
          {latestScore && (
            <span className="text-xs rounded-full bg-bronze/15 px-2 py-1 text-bronze">
              Última: {latestScore.score ?? "sem nota"}
            </span>
          )}
        </div>
        <div className="grid grid-cols-[90px_1fr] gap-2">
          <Input placeholder="0-10" value={score} onChange={(e) => setScore(e.target.value)} />
          <Input
            placeholder="Observação rápida"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <Button
          type="button"
          size="sm"
          onClick={saveScore}
          className="bg-bronze text-white hover:bg-wine"
        >
          Salvar acompanhamento
        </Button>
      </div>

      <PrivateChat
        student={student}
        teacherId={teacherId}
        messages={messages}
        onChanged={onChanged}
      />
    </div>
  );
}

function PrivateChat({
  student,
  teacherId,
  messages,
  onChanged,
}: {
  student: StudentProfile;
  teacherId?: string;
  messages: StudentMessage[];
  onChanged: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState("");

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !user || body.trim().length < 1) return;
    const { error } = await supabase.from("teacher_student_messages").insert({
      teacher_id: teacherId,
      student_id: student.id,
      sender_id: user.id,
      body: body.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
    await onChanged();
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="bg-wine text-white px-3 py-2 flex items-center gap-2">
        <MessageCircle className="h-4 w-4" />
        <p className="text-sm font-semibold">Chat privado</p>
      </div>
      <div className="h-44 overflow-y-auto bg-[#f7f0e9] p-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-xs text-brown-soft text-center py-10">Nenhuma mensagem ainda.</p>
        ) : (
          messages.map((message) => {
            const mine = message.sender_id === teacherId;
            return (
              <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-wine text-white" : "bg-white text-brown"}`}
                >
                  <p>{message.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-brown-soft"}`}>
                    {format(new Date(message.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form onSubmit={sendMessage} className="flex gap-2 border-t border-border p-2 bg-background">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Mensagem para o aluno..."
        />
        <Button
          className="bg-bronze text-white hover:bg-wine"
          size="icon"
          aria-label="Enviar mensagem"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

function AssignmentsPanel({
  classes,
  students,
  assignments,
  teacherId,
  onChanged,
}: {
  classes: ClassGroup[];
  students: StudentProfile[];
  assignments: ClassAssignment[];
  teacherId?: string;
  onChanged: () => void | Promise<void>;
}) {
  const [targetType, setTargetType] = useState<"class" | "student">("class");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (targetType === "class" && !classes.some((item) => item.id === classId)) {
      setClassId(classes[0]?.id ?? "");
    }
    if (targetType === "student" && !students.some((item) => item.id === studentId)) {
      setStudentId(students[0]?.id ?? "");
    }
  }, [targetType, classes, students, classId, studentId]);

  const submitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId) return;
    const selectedClassId = targetType === "class" ? classId : "";
    const selectedStudentId = targetType === "student" ? studentId : "";
    if (targetType === "class" && !selectedClassId) {
      toast.error("Escolha a turma que recebera a atividade.");
      return;
    }
    if (targetType === "student" && !selectedStudentId) {
      toast.error("Escolha o aluno que recebera a atividade.");
      return;
    }
    if (title.trim().length < 3) {
      toast.error("Informe o titulo da atividade.");
      return;
    }
    if (!file && !externalUrl.trim() && !instructions.trim()) {
      toast.error("Adicione um arquivo, link ou instrução.");
      return;
    }
    if (externalUrl.trim() && !normalizeExternalUrl(externalUrl)) {
      toast.error("Informe um link externo valido.");
      return;
    }
    setSubmitting(true);
    const uploaded = file ? await uploadLearningFile(teacherId, file) : null;
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
    const normalizedUrl = normalizeExternalUrl(externalUrl);
    const { error } = await supabase.from("class_assignments").insert({
      class_id: selectedClassId || null,
      student_id: selectedStudentId || null,
      teacher_id: teacherId,
      title: title.trim(),
      instructions: instructions.trim() || null,
      file_path: uploaded?.path ?? null,
      file_name: uploaded?.name ?? null,
      file_mime_type: uploaded?.mimeType ?? null,
      external_url: normalizedUrl,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      targetType === "class"
        ? "Atividade enviada para a turma."
        : "Atividade enviada para o aluno.",
    );
    setTitle("");
    setInstructions("");
    setExternalUrl("");
    setDueAt("");
    setFile(null);
    await onChanged();
  };

  const assignmentTargetLabel = (item: ClassAssignment) => {
    if (item.class_id) return classes.find((cls) => cls.id === item.class_id)?.name || "Turma";
    if (item.student_id) {
      return students.find((student) => student.id === item.student_id)?.full_name || "Aluno";
    }
    return "Destino direto";
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <form onSubmit={submitAssignment} className="rounded-2xl border border-border p-5 space-y-4">
        <h3 className="font-display text-xl text-wine">Enviar atividade</h3>
        <div className="space-y-2">
          <Label>Destino</Label>
          <Select
            value={targetType}
            onValueChange={(value) => setTargetType(value as "class" | "student")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="class">Enviar para turma</SelectItem>
              <SelectItem value="student">Enviar somente para aluno</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {targetType === "class" ? (
          <div className="space-y-2">
            <Label>Turma</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a turma" />
              </SelectTrigger>
              <SelectContent>
                {classes.length === 0 ? (
                  <SelectItem value="no-classes" disabled>
                    Nenhuma turma disponivel
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
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Aluno</Label>
            <Select value={studentId} onValueChange={setStudentId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o aluno" />
              </SelectTrigger>
              <SelectContent>
                {students.length === 0 ? (
                  <SelectItem value="no-students" disabled>
                    Nenhum aluno ativo encontrado
                  </SelectItem>
                ) : (
                  students.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.full_name || "Aluno"}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-2">
          <Label>Título</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Writing practice - Semana 3"
          />
        </div>
        <div className="space-y-2">
          <Label>Instruções</Label>
          <Textarea
            rows={3}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Prazo de entrega</Label>
          <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Arquivo PDF ou link</Label>
          <Input
            type="file"
            accept={LEARNING_FILE_ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Input
            value={externalUrl}
            onChange={(e) => setExternalUrl(e.target.value)}
            placeholder="Ou cole um link externo"
          />
        </div>
        <Button
          disabled={
            submitting ||
            (targetType === "class" && classes.length === 0) ||
            (targetType === "student" && students.length === 0)
          }
          className="w-full bg-bronze text-white hover:bg-wine gap-2"
        >
          <Upload className="h-4 w-4" />
          {submitting ? "Enviando..." : "Enviar atividade"}
        </Button>
      </form>

      <div className="rounded-2xl border border-border p-5">
        <h3 className="font-display text-xl text-wine mb-4">Atividades enviadas</h3>
        {assignments.length === 0 ? (
          <Empty msg="Nenhuma atividade enviada ainda." />
        ) : (
          <div className="space-y-3">
            {assignments.map((item) => (
              <ResourceRow
                key={item.id}
                title={item.title}
                subtitle={`${assignmentTargetLabel(item)}${item.due_at ? ` · prazo ${format(new Date(item.due_at), "dd/MM/yyyy HH:mm")}` : ""}`}
                filePath={item.file_path}
                fileName={item.file_name}
                externalUrl={item.external_url}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MaterialsPanel({
  classes,
  students,
  materials,
  requests,
  pricingMode,
  teacherId,
  onChanged,
}: {
  classes: ClassGroup[];
  students: StudentProfile[];
  materials: ClassMaterial[];
  requests: MaterialRequest[];
  pricingMode: "padrao" | "custom" | null;
  teacherId?: string;
  onChanged: () => void | Promise<void>;
}) {
  const [targetType, setTargetType] = useState<"class" | "student">("class");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [requestText, setRequestText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (targetType === "class" && !classes.some((item) => item.id === classId)) {
      setClassId(classes[0]?.id ?? "");
    }
    if (targetType === "student" && !students.some((item) => item.id === studentId)) {
      setStudentId(students[0]?.id ?? "");
    }
  }, [targetType, classes, students, classId, studentId]);

  const platformMaterials = materials.filter((item) => item.source === "platform");
  const directorMaterials = materials.filter((item) => item.source === "director");
  const teacherMaterials = materials.filter(
    (item) => item.source !== "platform" && item.source !== "director",
  );

  const submitMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId) return;
    const selectedClassId = targetType === "class" ? classId : "";
    const selectedStudentId = targetType === "student" ? studentId : "";
    if (targetType === "class" && !selectedClassId) {
      toast.error("Escolha a turma que recebera o material.");
      return;
    }
    if (targetType === "student" && !selectedStudentId) {
      toast.error("Escolha o aluno que recebera o material.");
      return;
    }
    if (title.trim().length < 3) {
      toast.error("Informe o titulo do material.");
      return;
    }
    if (!file && !externalUrl.trim()) {
      toast.error("Adicione um arquivo ou link.");
      return;
    }
    if (externalUrl.trim() && !normalizeExternalUrl(externalUrl)) {
      toast.error("Informe um link externo valido.");
      return;
    }
    setSubmitting(true);
    const uploaded = file ? await uploadLearningFile(teacherId, file) : null;
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
    const normalizedUrl = normalizeExternalUrl(externalUrl);
    const { error } = await supabase.from("class_materials").insert({
      class_id: selectedClassId || null,
      student_id: selectedStudentId || null,
      teacher_id: teacherId,
      title: title.trim(),
      description: description.trim() || null,
      source: "teacher",
      file_path: uploaded?.path ?? null,
      file_name: uploaded?.name ?? null,
      file_mime_type: uploaded?.mimeType ?? null,
      external_url: normalizedUrl,
      created_by: teacherId,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      targetType === "class" ? "Material enviado para a turma." : "Material enviado para o aluno.",
    );
    setTitle("");
    setDescription("");
    setExternalUrl("");
    setFile(null);
    await onChanged();
  };

  const submitRequest = async () => {
    if (!teacherId || requestText.trim().length < 10) {
      toast.error("Descreva o material que precisa solicitar à diretora.");
      return;
    }
    const { error } = await supabase.from("material_requests").insert({
      teacher_id: teacherId,
      class_id: classId || null,
      message: requestText.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Solicitação enviada à diretora.");
    setRequestText("");
    await onChanged();
  };

  const materialTargetLabel = (item: ClassMaterial) => {
    if (item.class_id) return classes.find((cls) => cls.id === item.class_id)?.name || "Turma";
    if (item.student_id) {
      return students.find((student) => student.id === item.student_id)?.full_name || "Aluno";
    }
    if (item.teacher_id === teacherId && item.source === "director") return "Enviado para voce";
    return "Destino direto";
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={submitMaterial} className="rounded-2xl border border-border p-5 space-y-4">
          <h3 className="font-display text-xl text-wine">Upload de material didático</h3>
          <div className="space-y-2">
            <Label>Destino</Label>
            <Select
              value={targetType}
              onValueChange={(value) => setTargetType(value as "class" | "student")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="class">Enviar para turma</SelectItem>
                <SelectItem value="student">Enviar somente para aluno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {targetType === "class" ? (
            <div className="space-y-2">
              <Label>Turma que receberá o material</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a turma" />
                </SelectTrigger>
                <SelectContent>
                  {classes.length === 0 ? (
                    <SelectItem value="no-classes" disabled>
                      Nenhuma turma disponivel
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
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Aluno que receberá o material</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o aluno" />
                </SelectTrigger>
                <SelectContent>
                  {students.length === 0 ? (
                    <SelectItem value="no-students" disabled>
                      Nenhum aluno ativo encontrado
                    </SelectItem>
                  ) : (
                    students.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.full_name || "Aluno"}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Arquivo PDF ou link</Label>
            <Input
              type="file"
              accept={LEARNING_FILE_ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Input
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="Ou cole um link externo"
            />
          </div>
          <Button
            disabled={
              submitting ||
              (targetType === "class" && classes.length === 0) ||
              (targetType === "student" && students.length === 0)
            }
            className="w-full bg-bronze text-white hover:bg-wine gap-2"
          >
            <Upload className="h-4 w-4" />
            {submitting ? "Enviando..." : "Disponibilizar material"}
          </Button>
        </form>

        <div className="rounded-2xl border border-border p-5 space-y-5">
          <div>
            <h3 className="font-display text-xl text-wine">Materiais padrão da plataforma</h3>
            <p className="text-sm text-brown-soft mt-1">
              Professores no padrão pedagógico usam estes materiais como base de aula.
            </p>
          </div>
          {platformMaterials.length === 0 ? (
            <Empty msg="Nenhum material padrão cadastrado ainda." />
          ) : (
            <div className="space-y-3">
              {platformMaterials.map((item) => (
                <ResourceRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.description || "Material padrão"}
                  filePath={item.file_path}
                  fileName={item.file_name}
                  externalUrl={item.external_url}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {pricingMode === "custom" && (
        <div className="rounded-2xl border border-bronze/40 bg-cream p-5">
          <h3 className="font-display text-xl text-wine">Solicitar material à diretora</h3>
          <p className="text-sm text-brown-soft mt-1">
            Como seu plano é personalizado, você pode pedir materiais pedagógicos específicos para a
            diretora.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <Textarea
              value={requestText}
              onChange={(e) => setRequestText(e.target.value)}
              placeholder="Descreva o objetivo da turma e o material que precisa..."
            />
            <Button
              type="button"
              onClick={submitRequest}
              className="bg-wine text-white hover:bg-bronze gap-2"
            >
              <Send className="h-4 w-4" />
              Solicitar
            </Button>
          </div>
          {requests.length > 0 && (
            <div className="mt-4 space-y-2">
              {requests.slice(0, 3).map((item) => (
                <div key={item.id} className="rounded-xl bg-background border border-border p-3">
                  <p className="text-sm text-wine font-semibold">
                    {requestStatusLabel(item.status)}
                  </p>
                  <p className="text-xs text-brown-soft mt-1">{item.message}</p>
                  {item.director_response && (
                    <p className="text-xs text-brown mt-2">{item.director_response}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {directorMaterials.length > 0 && (
        <div className="rounded-2xl border border-bronze/40 bg-cream p-5">
          <h3 className="font-display text-xl text-wine mb-4">Materiais da Diretoria</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {directorMaterials.map((item) => (
              <ResourceRow
                key={item.id}
                title={item.title}
                subtitle={materialTargetLabel(item)}
                filePath={item.file_path}
                fileName={item.file_name}
                externalUrl={item.external_url}
              />
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border p-5">
        <h3 className="font-display text-xl text-wine mb-4">Materiais enviados às turmas</h3>
        {teacherMaterials.length === 0 ? (
          <Empty msg="Nenhum material enviado ainda." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {teacherMaterials.map((item) => (
              <ResourceRow
                key={item.id}
                title={item.title}
                subtitle={`${materialTargetLabel(item)} · ${item.source === "director" ? "Diretora" : "Professor"}`}
                filePath={item.file_path}
                fileName={item.file_name}
                externalUrl={item.external_url}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SecretariatPanel({
  teacherId,
  announcements,
  meetings,
  messages,
  onChanged,
}: {
  teacherId?: string;
  announcements: TeacherAnnouncement[];
  meetings: TeacherMeeting[];
  messages: SecretariatMessage[];
  onChanged: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const [body, setBody] = useState("");

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !user || body.trim().length < 1) return;
    const { error } = await supabase.from("teacher_secretariat_messages").insert({
      teacher_id: teacherId,
      sender_id: user.id,
      sender_role: "teacher",
      body: body.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setBody("");
    await onChanged();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <div className="rounded-2xl border border-border p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-bronze" />
          <h3 className="font-display text-xl text-wine">Avisos e reuniões</h3>
        </div>
        <div className="space-y-3">
          {announcements.length === 0 ? (
            <p className="text-sm text-brown-soft">Nenhum aviso publicado.</p>
          ) : (
            announcements.map((item) => (
              <div key={item.id} className="rounded-xl bg-cream p-4">
                <p className="font-semibold text-wine">{item.title}</p>
                <p className="text-sm text-brown mt-1">{item.body}</p>
                {item.link_url && <ExternalButton url={item.link_url} label="Abrir aviso" />}
              </div>
            ))
          )}
        </div>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-brown-soft">Links de reunião</p>
          {meetings.length === 0 ? (
            <p className="text-sm text-brown-soft">Nenhuma reunião agendada.</p>
          ) : (
            meetings.map((item) => (
              <div key={item.id} className="rounded-xl border border-border p-4">
                <p className="font-semibold text-wine">{item.title}</p>
                <p className="text-sm text-brown-soft">
                  {format(new Date(item.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
                {item.meeting_url && (
                  <ExternalButton url={item.meeting_url} label="Entrar na reunião" />
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="bg-wine text-white p-4">
          <h3 className="font-display text-xl">Chat com a diretora</h3>
          <p className="text-xs text-white/70">
            Canal direto para dúvidas pedagógicas e secretaria.
          </p>
        </div>
        <div className="h-[420px] overflow-y-auto bg-[#f7f0e9] p-4 space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-brown-soft text-center py-20">Envie a primeira mensagem.</p>
          ) : (
            messages.map((message) => {
              const mine = message.sender_role === "teacher";
              return (
                <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[82%] rounded-2xl px-4 py-2 text-sm ${mine ? "bg-wine text-white" : "bg-white text-brown"}`}
                  >
                    <p>{message.body}</p>
                    <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-brown-soft"}`}>
                      {format(new Date(message.created_at), "dd/MM HH:mm")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <form onSubmit={send} className="flex gap-2 border-t border-border p-3">
          <Input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Mensagem para a secretaria..."
          />
          <Button className="bg-bronze text-white hover:bg-wine gap-2">
            <Send className="h-4 w-4" />
            Enviar
          </Button>
        </form>
      </div>
    </div>
  );
}

function ClassMeetingLinkEditor({
  item,
  onChanged,
}: {
  item: ClassGroup;
  onChanged: () => void | Promise<void>;
}) {
  const [url, setUrl] = useState(item.meeting_url || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("class_groups")
      .update({ meeting_url: url.trim() || null })
      .eq("id", item.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Link da turma atualizado.");
    await onChanged();
  };

  return (
    <div className="rounded-xl border border-border p-3">
      <Label className="text-xs">Link da videoaula da turma</Label>
      <div className="mt-2 flex flex-col sm:flex-row gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Cole o link da aula ao vivo"
        />
        <Button
          type="button"
          onClick={save}
          disabled={saving}
          className="bg-bronze text-white hover:bg-wine gap-2"
        >
          <LinkIcon className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      {item.meeting_url && <ExternalButton url={item.meeting_url} label="Abrir aula" />}
    </div>
  );
}

function ResourceRow({
  title,
  subtitle,
  filePath,
  fileName,
  externalUrl,
}: {
  title: string;
  subtitle?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  externalUrl?: string | null;
}) {
  const open = async () => {
    const normalizedUrl = normalizeExternalUrl(externalUrl);
    if (normalizedUrl) {
      window.open(normalizedUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (externalUrl && !normalizedUrl) {
      toast.error("Link externo invalido.");
      return;
    }
    if (filePath) {
      const ok = await openLearningFile(filePath);
      if (!ok) {
        const reason = getLastLearningOpenError();
        toast.error(
          reason
            ? `Não foi possível abrir o arquivo: ${reason}`
            : "Não foi possível abrir o arquivo.",
        );
      }
    }
  };

  return (
    <div className="rounded-xl border border-border p-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="font-semibold text-wine truncate">{title}</p>
        {subtitle && <p className="text-xs text-brown-soft mt-1">{subtitle}</p>}
        {fileName && <p className="text-xs text-bronze mt-2">{fileName}</p>}
      </div>
      {filePath || externalUrl ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-wine text-wine gap-2"
          onClick={open}
        >
          <FileText className="h-4 w-4" />
          Abrir
        </Button>
      ) : (
        <span className="rounded-full bg-cream px-3 py-1 text-xs text-brown-soft">Padrão</span>
      )}
    </div>
  );
}

function ExternalButton({ url, label }: { url: string; label: string }) {
  const normalizedUrl = normalizeExternalUrl(url);
  if (!normalizedUrl) return null;

  return (
    <a
      href={normalizedUrl}
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-bronze hover:text-wine"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

function WalletPanel({
  summary,
  transactions,
  withdrawals,
  teacherIdentity,
  payoutProfile,
  onChanged,
}: {
  summary: WalletSummary;
  transactions: WalletTransaction[];
  withdrawals: WithdrawalRequest[];
  teacherIdentity: TeacherIdentity | null;
  payoutProfile: TeacherPayoutProfile | null;
  onChanged: () => void | Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [pixKey, setPixKey] = useState(payoutProfile?.pix_key ?? "");
  const [holderName, setHolderName] = useState(
    payoutProfile?.account_holder_name ?? teacherIdentity?.full_name ?? "",
  );
  const [submitting, setSubmitting] = useState(false);
  const document = payoutProfile?.account_holder_document ?? teacherIdentity?.cpf ?? "";
  const payoutReady = pixKey.trim().length >= 3 && holderName.trim().length >= 2;
  const financialTransactions = transactions.filter(
    (item) =>
      item.transaction_type !== "withdrawal_hold" &&
      item.transaction_type !== "withdrawal_reversal",
  );

  useEffect(() => {
    setPixKey(payoutProfile?.pix_key ?? "");
    setHolderName(payoutProfile?.account_holder_name ?? teacherIdentity?.full_name ?? "");
  }, [payoutProfile, teacherIdentity]);

  const submitWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseMoney(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    if (parsedAmount > Number(summary.available_balance || 0)) {
      toast.error("Valor maior que o saldo disponível.");
      return;
    }

    if (!payoutReady) {
      toast.error("Atualize seus dados de saque no cadastro de professor antes de solicitar.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await requestTeacherWithdrawal({
        data: {
          amount: parsedAmount,
          pixKey: pixKey.trim(),
          accountHolderName: holderName.trim(),
          accountHolderDocument: document,
        },
      });
      toast.success(
        result.whatsappUrl
          ? "Saque registrado. Abrindo WhatsApp da plataforma."
          : "Saque registrado para transferencia manual pela diretoria.",
      );
      setAmount("");
      if (result.whatsappUrl) window.location.href = result.whatsappUrl;
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel solicitar o saque.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <WalletStat
          icon={Wallet}
          label="Saldo disponível"
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
          A assinatura paga credita a carteira do professor e reserva 10% como taxa da plataforma.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={submitWithdrawal} className="gw-app-card gw-input-shell rounded-xl p-5">
          <div>
            <h3 className="font-display text-xl text-wine">Solicitar saque Pix</h3>
            <p className="text-sm text-brown-soft mt-1">
              Informe o valor e confirme seus dados. Abriremos o WhatsApp da plataforma com a
              mensagem pronta para a diretoria.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Nome completo</Label>
            <Input
              value={holderName}
              readOnly
              className="bg-cream/70"
              placeholder="Nome do titular da chave Pix"
            />
          </div>

          {document && (
            <div className="space-y-2">
              <Label>CPF cadastrado</Label>
              <Input value={document} readOnly className="bg-cream/70" />
            </div>
          )}

          <div className="space-y-2">
            <Label>Chave Pix cadastrada</Label>
            <Input
              value={pixKey}
              readOnly
              className="bg-cream/70"
              placeholder="CPF, e-mail, telefone ou chave aleatoria"
            />
            <p className="text-xs text-brown-soft">
              Para alterar a chave oficial, use o botao editar do seu perfil de professor.
            </p>
            {!payoutReady && (
              <p className="text-xs font-semibold text-wine">
                Cadastre sua chave Pix na pagina de cadastro do professor para liberar o saque.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Valor que deseja sacar</Label>
            <Input
              inputMode="decimal"
              placeholder="Ex: 150,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <Button
            type="submit"
            disabled={submitting || !payoutReady || Number(summary.available_balance || 0) <= 0}
            className="w-full bg-bronze text-white hover:bg-wine shadow-bronze gap-2"
          >
            <MessageCircle className="h-4 w-4" />
            {submitting ? "Registrando..." : "Solicitar no WhatsApp"}
          </Button>
        </form>

        <div className="gw-app-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-5 w-5 text-bronze" />
            <h3 className="font-display text-xl text-wine">Historico financeiro</h3>
          </div>
          {financialTransactions.length === 0 ? (
            <Empty msg="Nenhum credito financeiro na carteira ainda." />
          ) : (
            <div className="space-y-3">
              {financialTransactions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-4 border-b border-border pb-3 last:border-b-0 last:pb-0"
                >
                  <div>
                    <p className="font-semibold text-wine text-sm">
                      {transactionLabel(item.transaction_type)}
                    </p>
                    <p className="text-xs text-brown-soft">
                      {format(new Date(item.created_at), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}
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

      <div className="gw-app-card rounded-xl p-5">
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
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${withdrawalStatusClass(item.status)}`}
                      >
                        {withdrawalStatusLabel(item.status)}
                      </span>
                      {item.payout_error ? (
                        <p className="mt-1 max-w-[280px] text-[11px] leading-snug text-brown-soft">
                          {item.payout_error}
                        </p>
                      ) : null}
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
    <div
      className={`rounded-xl border p-5 shadow-soft ${strong ? "bg-wine text-white" : "bg-white"}`}
    >
      <Icon className="h-5 w-5 mb-3 text-bronze" />
      <p className={`text-2xl font-display font-bold ${strong ? "text-white" : "text-wine"}`}>
        {value}
      </p>
      <p className={`text-xs mt-1 ${strong ? "text-white/70" : "text-brown-soft"}`}>{label}</p>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="gw-stat-card rounded-xl p-5">
      <Icon className="mb-3 h-5 w-5 text-bronze" />
      <p className="font-display text-3xl font-bold text-wine">{value}</p>
      <p className="mt-1 text-sm text-brown-soft">{label}</p>
    </div>
  );
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  return (
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-warm font-display text-white shadow-soft">
      {url ? <img src={url} className="w-full h-full object-cover" alt="" /> : name.charAt(0)}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="gw-empty-state rounded-xl px-5 py-12 text-center text-sm text-brown-soft">
      {msg}
    </div>
  );
}

function formatClassSchedule(item: ClassGroup) {
  if (item.day_of_week === null || !item.start_time) return "Horário a definir";
  const end = item.end_time ? ` - ${item.end_time.slice(0, 5)}` : "";
  return `${WEEKDAYS[item.day_of_week]} às ${item.start_time.slice(0, 5)}${end}`;
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

function inferPixKeyType(value: string): WithdrawalRequest["pix_key_type"] {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "email";
  if (digits.length === 11) return "cpf";
  if (digits.length >= 10 && digits.length <= 13) return "telefone";
  return "aleatoria";
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

function withdrawalStatusClass(status: WithdrawalRequest["status"]) {
  const classes: Record<WithdrawalRequest["status"], string> = {
    pendente: "bg-amber-100 text-amber-800",
    em_processamento: "bg-bronze/15 text-bronze",
    pago: "bg-emerald-100 text-emerald-700",
    falhou: "bg-red-100 text-red-700",
    cancelado: "bg-zinc-100 text-zinc-700",
  };
  return classes[status] ?? "bg-bronze/15 text-bronze";
}

function requestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pendente: "Pendente",
    em_preparo: "Em preparo",
    entregue: "Entregue",
    cancelado: "Cancelado",
  };
  return labels[status] ?? status;
}

function maskPixKey(value: string) {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function teacherCouponPrefix(name: string) {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  return (normalized + "GWLF").slice(0, 4);
}
