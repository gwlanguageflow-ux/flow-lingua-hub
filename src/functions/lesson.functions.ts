import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const scheduleTeacherLessonSchema = z.object({
  studentId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.coerce.number().int().min(15).max(240),
  meetingUrl: z.string().trim().max(500).optional().or(z.literal("")),
});

function isSafeMeetingUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const scheduleTeacherLesson = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => scheduleTeacherLessonSchema.parse(input))
  .handler(async ({ data, context }) => {
    const teacherId = context.userId;
    const scheduledAt = new Date(data.scheduledAt);
    const meetingUrl = data.meetingUrl?.trim() || null;

    if (!Number.isFinite(scheduledAt.getTime())) {
      throw new Error("Data ou horario invalido.");
    }

    if (scheduledAt <= new Date()) {
      throw new Error("Escolha um horario futuro para a aula.");
    }

    if (meetingUrl && !isSafeMeetingUrl(meetingUrl)) {
      throw new Error("Informe um link de aula valido, iniciando com http:// ou https://.");
    }

    const { data: teacherProfile, error: teacherError } = await supabaseAdmin
      .from("teacher_profiles")
      .select("id")
      .eq("id", teacherId)
      .eq("is_active", true)
      .maybeSingle();

    if (teacherError) throw new Error(teacherError.message);
    if (!teacherProfile) throw new Error("Professor nao encontrado ou inativo.");

    const { data: activeSubscription, error: subscriptionError } = await supabaseAdmin
      .from("student_subscriptions")
      .select("id")
      .eq("teacher_id", teacherId)
      .eq("student_id", data.studentId)
      .eq("status", "ativa")
      .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`)
      .limit(1)
      .maybeSingle();

    if (subscriptionError) throw new Error(subscriptionError.message);
    if (!activeSubscription) {
      const { data: latest } = await supabaseAdmin
        .from("student_subscriptions")
        .select("status, current_period_end")
        .eq("teacher_id", teacherId)
        .eq("student_id", data.studentId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latest) {
        throw new Error("Este aluno não possui assinatura vinculada a você. Confira se ele assinou o seu plano.");
      }
      if (latest.status === "ativa" && latest.current_period_end) {
        throw new Error(
          `A assinatura deste aluno venceu em ${new Date(latest.current_period_end).toLocaleDateString("pt-BR")}.`,
        );
      }
      const reasons: Record<string, string> = {
        pendente: "aguardando ativação pela diretoria",
        inadimplente: "inadimplente",
        cancelada: "cancelada",
        expirada: "expirada",
      };
      throw new Error(
        `A assinatura deste aluno com você está ${reasons[latest.status] ?? latest.status}.`,
      );
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        teacher_id: teacherId,
        student_id: data.studentId,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: data.durationMinutes,
        meeting_url: meetingUrl,
        status: "pendente",
      })
      .select("*")
      .single();

    if (bookingError) throw new Error(bookingError.message);

    const message = meetingUrl
      ? `Aula agendada para ${scheduledAt.toLocaleString("pt-BR")}. Link da aula: ${meetingUrl}`
      : `Aula agendada para ${scheduledAt.toLocaleString("pt-BR")}. Confirme sua presenca no painel.`;

    await supabaseAdmin.from("teacher_student_messages").insert({
      teacher_id: teacherId,
      student_id: data.studentId,
      sender_id: teacherId,
      body: message,
    });

    return { booking };
  });
