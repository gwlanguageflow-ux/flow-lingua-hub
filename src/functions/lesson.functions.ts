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

    const [{ data: activeSubscription, error: subscriptionError }, { data: activeClassMember }] =
      await Promise.all([
        supabaseAdmin
          .from("student_subscriptions")
          .select("id")
          .eq("teacher_id", teacherId)
          .eq("student_id", data.studentId)
          .eq("status", "ativa")
          .or(`current_period_end.is.null,current_period_end.gt.${new Date().toISOString()}`)
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("class_members")
          .select("id, class_groups!inner(teacher_id, status)")
          .eq("student_id", data.studentId)
          .eq("status", "ativo")
          .eq("class_groups.teacher_id", teacherId)
          .eq("class_groups.status", "ativa")
          .limit(1)
          .maybeSingle(),
      ]);

    if (subscriptionError) throw new Error(subscriptionError.message);
    if (!activeSubscription && !activeClassMember) {
      throw new Error("Este aluno ainda nao esta ativo com voce.");
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
