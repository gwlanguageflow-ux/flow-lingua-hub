import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BookOpen,
  CalendarCheck,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  GraduationCap,
  Headphones,
  MessageCircle,
  Send,
  Sparkles,
  Star,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MeetingLinkButton } from "@/components/MeetingLinkEditor";
import { SubscriptionStatusBanner } from "@/components/SubscriptionStatusBanner";
import { StudyStreakBanner } from "@/components/StudyStreakBanner";
import { WEEKDAYS } from "@/lib/constants";
import { normalizeExternalUrl } from "@/lib/resource-links";
import { getLastLearningOpenError, openLearningFile } from "@/lib/upload";
import type { Tables } from "@/integrations/supabase/types";

type Booking = Tables<"bookings">;
type ClassGroup = Tables<"class_groups">;
type ClassMember = Tables<"class_members">;
type ClassMaterial = Tables<"class_materials">;
type ClassAssignment = Tables<"class_assignments">;
type ClassAssignmentSubmission = Tables<"class_assignment_submissions">;
type StudentMessage = Tables<"teacher_student_messages">;
type StudentScore = Tables<"student_scores">;
type TeacherProfile = Pick<Tables<"profiles">, "id" | "full_name" | "avatar_url">;

export const Route = createFileRoute("/meus-agendamentos")({
  head: () => ({ meta: [{ title: "Meus agendamentos — GWLanguageFlow" }] }),
  component: () => (
    <RequireAuth allow={["aluno", "dev"]}>
      <Page />
    </RequireAuth>
  ),
});

function Page() {
  const { user } = useAuth();
  const [items, setItems] = useState<Booking[]>([]);
  const [teachers, setTeachers] = useState<Map<string, TeacherProfile>>(new Map());
  const [reviews, setReviews] = useState<Set<string>>(new Set());
  const [memberships, setMemberships] = useState<ClassMember[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [materials, setMaterials] = useState<ClassMaterial[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignment[]>([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<ClassAssignmentSubmission[]>(
    [],
  );
  const [messages, setMessages] = useState<StudentMessage[]>([]);
  const [scores, setScores] = useState<StudentScore[]>([]);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [
      { data: bookingRows },
      { data: memberRows },
      { data: materialRows },
      { data: assignmentRows },
      { data: submissionRows },
      { data: messageRows },
      { data: scoreRows },
    ] = await Promise.all([
      supabase
        .from("bookings")
        .select("*")
        .eq("student_id", user.id)
        .order("scheduled_at", { ascending: false }),
      supabase.from("class_members").select("*").eq("student_id", user.id).eq("status", "ativo"),
      supabase.from("class_materials").select("*").order("created_at", { ascending: false }),
      supabase.from("class_assignments").select("*").order("created_at", { ascending: false }),
      supabase
        .from("class_assignment_submissions")
        .select("*")
        .eq("student_id", user.id)
        .order("completed_at", { ascending: false }),
      supabase
        .from("teacher_student_messages")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("student_scores")
        .select("*")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    setItems(bookingRows || []);
    setMemberships(memberRows || []);
    setMessages(messageRows || []);
    setScores(scoreRows || []);
    setAssignmentSubmissions(submissionRows || []);

    let classRows: ClassGroup[] = [];
    if (memberRows?.length) {
      const classIds = memberRows.map((item) => item.class_id);
      const { data } = await supabase.from("class_groups").select("*").in("id", classIds);
      classRows = data || [];
      setClasses(classRows);
    } else {
      setClasses([]);
    }

    const activeClassIds = new Set((memberRows || []).map((item) => item.class_id));
    const visibleMaterials = (materialRows || []).filter((item) => {
      if (item.source === "platform") return true;
      if (item.student_id === user.id) return true;
      return Boolean(item.class_id && activeClassIds.has(item.class_id));
    });
    const visibleAssignments = (assignmentRows || []).filter((item) => {
      if (item.student_id === user.id) return true;
      return Boolean(item.class_id && activeClassIds.has(item.class_id));
    });

    setMaterials(visibleMaterials);
    setAssignments(visibleAssignments);

    const teacherIds = Array.from(
      new Set([
        ...(bookingRows || []).map((b) => b.teacher_id),
        ...classRows.map((c) => c.teacher_id),
        ...visibleMaterials.map((m) => m.teacher_id).filter((id): id is string => Boolean(id)),
        ...visibleAssignments.map((a) => a.teacher_id).filter((id): id is string => Boolean(id)),
      ]),
    );

    if (teacherIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", teacherIds);
      setTeachers(new Map(profs?.map((p) => [p.id, p]) ?? []));
    } else {
      setTeachers(new Map());
    }

    if (bookingRows?.length) {
      const { data: revs } = await supabase
        .from("reviews")
        .select("booking_id")
        .in(
          "booking_id",
          bookingRows.map((b) => b.id),
        );
      setReviews(new Set(revs?.map((r) => r.booking_id) ?? []));
    } else {
      setReviews(new Set());
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;

    setCheckoutSuccess(true);
    toast.success(
      "Parabéns pela sua assinatura! A GWLanguageFlow vai cuidar da sua evolução de perto. Você não vai se arrepender.",
      { duration: 8000 },
    );

    params.delete("checkout");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`student-live-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teacher_student_messages",
          filter: `student_id=eq.${user.id}`,
        },
        () => load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "student_scores",
          filter: `student_id=eq.${user.id}`,
        },
        () => load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "class_materials" }, () =>
        load(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "class_assignments" }, () =>
        load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_assignment_submissions",
          filter: `student_id=eq.${user.id}`,
        },
        () => load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `student_id=eq.${user.id}`,
        },
        () => load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "class_members",
          filter: `student_id=eq.${user.id}`,
        },
        () => load(),
      )
      .subscribe();

    const interval = window.setInterval(load, 20000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [load, user]);

  const upcomingItems = items.filter(
    (item) => new Date(item.scheduled_at) > new Date() && item.status !== "cancelado",
  );
  const completedItems = items.filter((item) => item.status === "concluido");
  const completedAssignmentIds = new Set(
    assignmentSubmissions.map((submission) => submission.assignment_id),
  );
  const pendingAssignments = assignments.filter(
    (item) =>
      !completedAssignmentIds.has(item.id) && (!item.due_at || new Date(item.due_at) >= new Date()),
  );

  return (
    <div className="gw-app-shell min-h-screen">
      <SiteHeader />
      <main className="container mx-auto max-w-7xl px-4 py-8 md:py-10">
        <section className="gw-command-hero mb-6 overflow-hidden rounded-xl">
          <div className="grid gap-px bg-border/70 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="bg-white/92 p-7 md:p-9">
              <p className="text-sm font-bold uppercase text-bronze">Dashboard do aluno</p>
              <h1 className="mt-3 font-display text-4xl font-bold leading-tight text-wine md:text-5xl">
                Minha jornada
              </h1>
              <p className="mt-3 max-w-2xl leading-7 text-brown-soft">
                Acompanhe aulas, turmas, atividades, materiais e mensagens em uma rotina clara de
                evolução.
              </p>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
                <StudentMetric icon={Video} label="Próximas aulas" value={upcomingItems.length} />
                <StudentMetric icon={Users} label="Turmas ativas" value={classes.length} />
                <StudentMetric
                  icon={GraduationCap}
                  label="Atividades abertas"
                  value={pendingAssignments.length}
                />
              </div>
            </div>

            <aside className="bg-ink p-7 text-white md:p-8">
              <div className="rounded-xl border border-white/10 bg-white/7 p-5">
                <div className="flex items-start gap-3">
                  <CalendarCheck className="mt-1 h-6 w-6 text-bronze" />
                  <div>
                    <p className="font-display text-2xl font-bold text-white">Próxima aula</p>
                    <p className="mt-2 text-sm leading-6 text-white/68">
                      {upcomingItems[0]
                        ? format(
                            new Date(upcomingItems[0].scheduled_at),
                            "EEEE, dd/MM 'às' HH:mm",
                            {
                              locale: ptBR,
                            },
                          )
                        : "Nenhuma aula próxima na agenda."}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-white/10 bg-white/7 p-4">
                  <p className="font-display text-2xl font-bold text-bronze">
                    {completedItems.length}
                  </p>
                  <p className="mt-1 text-xs text-white/66">aulas concluídas</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/7 p-4">
                  <p className="font-display text-2xl font-bold text-bronze">{materials.length}</p>
                  <p className="mt-1 text-xs text-white/66">materiais disponíveis</p>
                </div>
              </div>
            </aside>
          </div>
        </section>
        {checkoutSuccess && (
          <section className="mb-6 overflow-hidden rounded-xl border border-bronze/30 bg-white shadow-soft">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bronze text-white shadow-bronze">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-display text-2xl font-bold text-wine">
                  Parabéns pela sua assinatura!
                </p>
                <p className="mt-1 leading-7 text-brown-soft">
                  A GWLanguageFlow vai cuidar da sua evolução de perto. Você não vai se arrepender.
                </p>
              </div>
            </div>
          </section>
        )}
        <SubscriptionStatusBanner />
        <StudyStreakBanner />

        <Tabs defaultValue="aulas" className="gw-app-card mt-6 rounded-xl p-3 md:p-5">
          <TabsList className="gw-tab-list h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1">
            <StudentTab value="aulas" icon={Video} label="Minhas Aulas" />
            <StudentTab value="turmas" icon={Users} label="Turmas" />
            <StudentTab value="atividades" icon={GraduationCap} label="Atividades" />
            <StudentTab value="materiais" icon={FolderOpen} label="Materiais" />
            <StudentTab value="mensagens" icon={MessageCircle} label="Mensagens" />
          </TabsList>

          <TabsContent value="aulas" className="mt-6">
            <LessonsSection
              items={items}
              teachers={teachers}
              reviews={reviews}
              studentId={user?.id}
              onDone={load}
            />
          </TabsContent>

          <TabsContent value="turmas" className="mt-6">
            <StudentClassesSection classes={classes} teachers={teachers} scores={scores} />
          </TabsContent>

          <TabsContent value="atividades" className="mt-6">
            <StudentAssignmentsSection
              assignments={assignments}
              classes={classes}
              submissions={assignmentSubmissions}
              studentId={user?.id}
              onChanged={load}
            />
          </TabsContent>

          <TabsContent value="materiais" className="mt-6">
            <StudentMaterialsSection materials={materials} classes={classes} />
          </TabsContent>

          <TabsContent value="mensagens" className="mt-6">
            <StudentMessagesSection
              userId={user?.id}
              teachers={teachers}
              messages={messages}
              classes={classes}
              bookings={items}
              onChanged={load}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StudentMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Video;
  label: string;
  value: number;
}) {
  return (
    <div className="gw-stat-card rounded-xl p-5">
      <Icon className="mb-3 h-5 w-5 text-bronze" />
      <p className="font-display text-3xl font-bold text-wine">{value}</p>
      <p className="mt-1 text-sm text-brown-soft">{label}</p>
    </div>
  );
}

function StudentTab({
  value,
  icon: Icon,
  label,
}: {
  value: string;
  icon: typeof Video;
  label: string;
}) {
  return (
    <TabsTrigger value={value} className="gw-tab-trigger px-4 py-2 text-sm font-semibold">
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </TabsTrigger>
  );
}

function LessonsSection({
  items,
  teachers,
  reviews,
  studentId,
  onDone,
}: {
  items: Booking[];
  teachers: Map<string, TeacherProfile>;
  reviews: Set<string>;
  studentId?: string;
  onDone: () => void;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const confirmPresence = async (booking: Booking) => {
    if (!studentId) return;
    setConfirmingId(booking.id);
    const { error } = await supabase
      .from("bookings")
      .update({ status: "confirmado" })
      .eq("id", booking.id)
      .eq("student_id", studentId)
      .eq("status", "pendente");
    setConfirmingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Presenca confirmada. Boa aula!");
    onDone();
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-brown-soft">Você ainda não agendou aulas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((b) => {
        const t = teachers.get(b.teacher_id);
        const past = new Date(b.scheduled_at) < new Date();
        const canReview = past && b.status !== "cancelado" && !reviews.has(b.id);
        return (
          <div
            key={b.id}
            className="gw-app-card flex flex-col gap-4 rounded-xl p-5 transition hover:-translate-y-0.5 md:flex-row md:items-center"
          >
            <Avatar name={t?.full_name || "Professor"} url={t?.avatar_url} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-wine">{t?.full_name || "Professor"}</p>
              <p className="text-sm text-brown">
                {format(new Date(b.scheduled_at), "EEEE, d 'de' MMMM 'às' HH:mm", {
                  locale: ptBR,
                })}
              </p>
              <p className="text-xs text-brown-soft mt-1">{b.duration_minutes} min</p>
              {!past && !b.meeting_url && (
                <p className="text-xs text-brown-soft mt-2 italic flex items-center gap-1">
                  <Video className="h-3 w-3" /> Aguardando link da videochamada do professor
                </p>
              )}
            </div>
            <div className="flex flex-col items-stretch md:items-end gap-2">
              <span className="text-xs px-3 py-1 rounded-full bg-bronze/15 text-bronze capitalize text-center">
                {studentBookingStatusLabel(b.status)}
              </span>
              {b.meeting_url && <MeetingLinkButton url={b.meeting_url} />}
              {b.status === "pendente" && (
                <Button
                  size="sm"
                  onClick={() => confirmPresence(b)}
                  disabled={confirmingId === b.id}
                  className="bg-wine text-white hover:bg-bronze"
                >
                  {confirmingId === b.id ? "Confirmando..." : "Confirmar presenca"}
                </Button>
              )}
              {canReview && <ReviewDialog booking={b} onDone={onDone} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StudentClassesSection({
  classes,
  teachers,
  scores,
}: {
  classes: ClassGroup[];
  teachers: Map<string, TeacherProfile>;
  scores: StudentScore[];
}) {
  if (classes.length === 0) return <Empty msg="Você ainda não foi vinculado a uma turma." />;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {classes.map((item) => {
        const teacher = teachers.get(item.teacher_id);
        const lastScore = scores.find((score) => score.class_id === item.id);
        return (
          <div key={item.id} className="gw-app-card rounded-xl p-5">
            <div>
              <h3 className="font-display text-xl text-wine">{item.name}</h3>
              <p className="text-sm text-brown">{item.language}</p>
              <p className="text-sm text-brown-soft">{formatClassSchedule(item)}</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-cream p-3">
              <Avatar name={teacher?.full_name || "Professor"} url={teacher?.avatar_url} />
              <div>
                <p className="font-semibold text-wine">{teacher?.full_name || "Professor"}</p>
                <p className="text-xs text-brown-soft">Professor da turma</p>
              </div>
            </div>
            {item.meeting_url ? (
              <MeetingLinkButton url={item.meeting_url} />
            ) : (
              <p className="text-xs text-brown-soft">Aguardando link da aula.</p>
            )}
            {lastScore && (
              <div className="rounded-xl border border-border p-3">
                <p className="text-sm font-semibold text-wine">
                  Último acompanhamento: {lastScore.score ?? "sem nota"}
                </p>
                {lastScore.note && <p className="text-xs text-brown mt-1">{lastScore.note}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StudentAssignmentsSection({
  assignments,
  classes,
  submissions,
  studentId,
  onChanged,
}: {
  assignments: ClassAssignment[];
  classes: ClassGroup[];
  submissions: ClassAssignmentSubmission[];
  studentId?: string;
  onChanged: () => void | Promise<void>;
}) {
  if (assignments.length === 0) return <Empty msg="Nenhuma atividade enviada ainda." />;

  const submissionMap = new Map(submissions.map((item) => [item.assignment_id, item]));

  const assignmentTargetLabel = (item: ClassAssignment) => {
    if (item.class_id) return classes.find((cls) => cls.id === item.class_id)?.name || "Turma";
    if (item.student_id) return "Enviado diretamente para você";
    return "Atividade enviada";
  };

  const confirmAssignmentDone = async (item: ClassAssignment) => {
    if (!studentId) return;
    if (submissionMap.has(item.id)) {
      toast.info("Esta atividade ja foi marcada como feita.");
      return;
    }
    const confirmed = window.confirm("Confirmar que voce fez esta atividade?");
    if (!confirmed) return;

    const { error } = await supabase.from("class_assignment_submissions").insert({
      assignment_id: item.id,
      student_id: studentId,
      teacher_id: item.teacher_id,
    });

    if (error) {
      if (error.code === "23505") {
        toast.info("Esta atividade ja estava marcada como feita.");
        await onChanged();
        return;
      }
      toast.error(error.message);
      return;
    }

    toast.success("Atividade marcada como feita. O professor foi avisado.");
    await onChanged();
  };

  return (
    <div className="space-y-3">
      {assignments.map((item) => {
        const submission = submissionMap.get(item.id);
        return (
          <div key={item.id} className="space-y-2">
            <ResourceRow
              icon={GraduationCap}
              title={item.title}
              subtitle={`${assignmentTargetLabel(item)}${item.due_at ? ` · prazo ${format(new Date(item.due_at), "dd/MM/yyyy HH:mm")}` : ""}`}
              description={item.instructions}
              filePath={item.file_path}
              fileName={item.file_name}
              externalUrl={item.external_url}
            />
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between">
              {submission ? (
                <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Pronto em {format(new Date(submission.completed_at), "dd/MM/yyyy HH:mm")}
                </p>
              ) : (
                <p className="text-sm font-semibold text-amber-800">
                  Pendente - marque quando terminar para avisar o professor.
                </p>
              )}
              {!submission && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => confirmAssignmentDone(item)}
                  className="bg-wine text-white hover:bg-bronze"
                >
                  Fiz atividades
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StudentMaterialsSection({
  materials,
  classes,
}: {
  materials: ClassMaterial[];
  classes: ClassGroup[];
}) {
  const materialTargetLabel = (item: ClassMaterial) => {
    if (item.source === "platform") return "Material padrão da plataforma";
    if (item.student_id) return "Enviado diretamente para você";
    if (item.class_id) return classes.find((cls) => cls.id === item.class_id)?.name || "Turma";
    if (item.source === "director") return "Enviado pela Diretoria";
    return "Material disponível";
  };

  const categories = [
    {
      icon: FileText,
      title: "Revisões",
      desc: "Resumos consolidados de cada conteúdo trabalhado em aula.",
    },
    {
      icon: Headphones,
      title: "Listening & Reading",
      desc: "Áudios e textos selecionados para fixação semanal.",
    },
    {
      icon: BookOpen,
      title: "Homeworks",
      desc: "Atividades semanais com correção do professor.",
    },
    {
      icon: Sparkles,
      title: "Atividades Personalizadas",
      desc: "Materiais sob medida para o seu objetivo de aprendizado.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {categories.map((c) => (
          <div key={c.title} className="gw-app-card flex gap-4 rounded-xl p-5">
            <div className="h-11 w-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-bronze/15 text-bronze">
              <c.icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-wine">{c.title}</p>
              <p className="text-xs text-brown-soft mt-1">{c.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="gw-app-card rounded-xl p-5">
        <h3 className="font-display text-xl text-wine mb-4">Arquivos disponíveis</h3>
        {materials.length === 0 ? (
          <Empty msg="Nenhum material disponível ainda." />
        ) : (
          <div className="space-y-3">
            {materials.map((item) => (
              <ResourceRow
                key={item.id}
                icon={FolderOpen}
                title={item.title}
                subtitle={materialTargetLabel(item)}
                description={item.description}
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

function StudentMessagesSection({
  userId,
  teachers,
  messages,
  classes,
  bookings,
  onChanged,
}: {
  userId?: string;
  teachers: Map<string, TeacherProfile>;
  messages: StudentMessage[];
  classes: ClassGroup[];
  bookings: Booking[];
  onChanged: () => void | Promise<void>;
}) {
  const teacherIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...classes.map((item) => item.teacher_id),
          ...bookings.map((item) => item.teacher_id),
        ]),
      ),
    [bookings, classes],
  );
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const activeTeacher = selectedTeacher || teacherIds[0] || "";

  useEffect(() => {
    if (!selectedTeacher && teacherIds[0]) setSelectedTeacher(teacherIds[0]);
  }, [selectedTeacher, teacherIds]);

  if (!teacherIds.length) return <Empty msg="Você ainda não tem professores para conversar." />;

  return (
    <div className="grid gap-5 md:grid-cols-[240px_1fr]">
      <div className="gw-app-card space-y-2 rounded-xl p-3">
        {teacherIds.map((id) => {
          const teacher = teachers.get(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedTeacher(id)}
              className={`w-full rounded-xl p-3 text-left flex items-center gap-3 ${activeTeacher === id ? "bg-wine text-white" : "bg-cream text-wine"}`}
            >
              <Avatar name={teacher?.full_name || "Professor"} url={teacher?.avatar_url} />
              <span className="text-sm font-semibold truncate">
                {teacher?.full_name || "Professor"}
              </span>
            </button>
          );
        })}
      </div>
      <StudentChat
        userId={userId}
        teacherId={activeTeacher}
        teacher={teachers.get(activeTeacher)}
        messages={messages.filter((item) => item.teacher_id === activeTeacher)}
        onChanged={onChanged}
      />
    </div>
  );
}

function StudentChat({
  userId,
  teacherId,
  teacher,
  messages,
  onChanged,
}: {
  userId?: string;
  teacherId: string;
  teacher?: TeacherProfile;
  messages: StudentMessage[];
  onChanged: () => void | Promise<void>;
}) {
  const [body, setBody] = useState("");
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !teacherId || body.trim().length < 1) return;
    const { error } = await supabase.from("teacher_student_messages").insert({
      teacher_id: teacherId,
      student_id: userId,
      sender_id: userId,
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
    <div className="overflow-hidden rounded-xl border border-border bg-white shadow-soft">
      <div className="bg-wine text-white px-4 py-3">
        <p className="font-semibold">Chat com {teacher?.full_name || "professor"}</p>
        <p className="text-xs text-white/70">
          Conversa privada sobre aulas, materiais e atividades.
        </p>
      </div>
      <div className="h-[420px] overflow-y-auto bg-[#f7f0e9] p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-brown-soft text-center py-20">Nenhuma mensagem ainda.</p>
        ) : (
          messages.map((message) => {
            const mine = message.sender_id === userId;
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
          placeholder="Escreva uma mensagem..."
        />
        <Button className="bg-bronze text-white hover:bg-wine gap-2">
          <Send className="h-4 w-4" />
          Enviar
        </Button>
      </form>
    </div>
  );
}

function ReviewDialog({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    const { error } = await supabase.from("reviews").insert({
      booking_id: booking.id,
      student_id: booking.student_id,
      teacher_id: booking.teacher_id,
      rating,
      comment: comment.trim() || null,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Avaliação enviada!");
    setOpen(false);
    onDone();
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-bronze text-white hover:bg-wine">
          Avaliar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-wine font-display">Avalie sua aula</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} type="button">
                <Star
                  className={`h-8 w-8 ${n <= rating ? "fill-bronze text-bronze" : "text-border"}`}
                />
              </button>
            ))}
          </div>
          <Textarea
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Conte como foi sua experiência (opcional)"
          />
          <Button
            onClick={submit}
            disabled={loading}
            className="w-full bg-bronze text-white hover:bg-wine"
          >
            {loading ? "Enviando..." : "Enviar avaliação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResourceRow({
  icon: Icon,
  title,
  subtitle,
  description,
  filePath,
  fileName,
  externalUrl,
}: {
  icon: typeof FileText;
  title: string;
  subtitle?: string | null;
  description?: string | null;
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
    <div className="gw-app-card flex items-start gap-4 rounded-xl p-5">
      <div className="h-11 w-11 rounded-xl bg-bronze/15 text-bronze flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-wine">{title}</p>
        {subtitle && <p className="text-xs text-brown-soft mt-1">{subtitle}</p>}
        {description && <p className="text-sm text-brown mt-2">{description}</p>}
        {fileName && <p className="text-xs text-bronze mt-2">{fileName}</p>}
      </div>
      {(filePath || externalUrl) && (
        <Button variant="outline" size="sm" className="border-wine text-wine gap-2" onClick={open}>
          <Download className="h-4 w-4" />
          Abrir
        </Button>
      )}
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

function studentBookingStatusLabel(status: Booking["status"]) {
  const labels: Record<Booking["status"], string> = {
    pendente: "Confirmacao pendente",
    confirmado: "Presenca confirmada",
    concluido: "Concluida",
    cancelado: "Cancelada",
  };
  return labels[status] ?? status;
}

function formatClassSchedule(item: ClassGroup) {
  if (item.day_of_week === null || !item.start_time) return "Horário a definir";
  const end = item.end_time ? ` - ${item.end_time.slice(0, 5)}` : "";
  return `${WEEKDAYS[item.day_of_week]} às ${item.start_time.slice(0, 5)}${end}`;
}
