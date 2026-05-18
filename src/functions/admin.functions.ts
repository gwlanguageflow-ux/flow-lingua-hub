import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Enums, Tables } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;
type TargetType = "all" | "role" | "user" | "class";
type DirectorTarget = {
  target_type: TargetType;
  target_role: AppRole | null;
  target_user_id: string | null;
  target_class_id: string | null;
};

const targetSchema = z.object({
  targetType: z.enum(["all", "role", "user", "class"]),
  targetRole: z.enum(["dev", "professor", "aluno"]).optional().nullable(),
  targetUserId: z.string().uuid().optional().nullable(),
  targetClassId: z.string().uuid().optional().nullable(),
});

const messageSchema = targetSchema.extend({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(3000),
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
});

const alertSchema = targetSchema.extend({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(2000),
  tone: z.enum(["info", "warning", "urgent"]).default("info"),
  active: z.boolean().default(true),
  expiresAt: z.string().datetime().optional().nullable(),
});

const directMessageSchema = z.object({
  userId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

const reportSchema = z.object({
  category: z.string().trim().min(3).max(80).default("geral"),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(3000),
});

const updateReportSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(["novo", "em_analise", "resolvido", "arquivado"]),
  adminNotes: z.string().trim().max(2000).optional().nullable(),
});

const alertStatusSchema = z.object({
  alertId: z.string().uuid(),
  active: z.boolean(),
});

const readSchema = z.object({
  messageId: z.string().uuid(),
});

const trimRole = (role: AppRole | null | undefined) => role ?? null;

function normalizeTarget(input: z.infer<typeof targetSchema>): DirectorTarget {
  if (input.targetType === "all") {
    return {
      target_type: "all",
      target_role: null,
      target_user_id: null,
      target_class_id: null,
    };
  }

  if (input.targetType === "role") {
    if (!input.targetRole) throw new Error("Selecione o perfil de destino.");
    return {
      target_type: "role",
      target_role: trimRole(input.targetRole),
      target_user_id: null,
      target_class_id: null,
    };
  }

  if (input.targetType === "user") {
    if (!input.targetUserId) throw new Error("Selecione o usuário de destino.");
    return {
      target_type: "user",
      target_role: null,
      target_user_id: input.targetUserId,
      target_class_id: null,
    };
  }

  if (!input.targetClassId) throw new Error("Selecione a turma de destino.");
  return {
    target_type: "class",
    target_role: null,
    target_user_id: null,
    target_class_id: input.targetClassId,
  };
}

async function requireDirector(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: role, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "dev")
    .maybeSingle();

  if (error || !role) {
    throw new Response("Forbidden", { status: 403 });
  }

  return supabaseAdmin;
}

function isTargetedToUser(
  item: DirectorTarget,
  userId: string,
  roles: AppRole[],
  classIds: Set<string>,
) {
  if (item.target_type === "all") return true;
  if (item.target_type === "role" && item.target_role) return roles.includes(item.target_role);
  if (item.target_type === "user") return item.target_user_id === userId;
  if (item.target_type === "class" && item.target_class_id)
    return classIds.has(item.target_class_id);
  return false;
}

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await requireDirector(context.userId);

    const [
      { data: profiles },
      { data: roles },
      { data: teachers },
      { data: students },
      { data: bookings },
      { data: classes },
      { data: classMembers },
      { data: directorMessages },
      { data: directorAlerts },
      { data: directMessages },
      { data: anonymousReports },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("*"),
      supabaseAdmin.from("teacher_profiles").select("*"),
      supabaseAdmin.from("student_profiles").select("*"),
      supabaseAdmin.from("bookings").select("*").order("scheduled_at", { ascending: false }),
      supabaseAdmin.from("class_groups").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("class_members").select("*"),
      supabaseAdmin
        .from("director_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("director_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("director_user_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(500),
      supabaseAdmin
        .from("anonymous_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    return {
      profiles: profiles ?? [],
      roles: roles ?? [],
      teachers: teachers ?? [],
      students: students ?? [],
      bookings: bookings ?? [],
      classes: classes ?? [],
      classMembers: classMembers ?? [],
      directorMessages: directorMessages ?? [],
      directorAlerts: directorAlerts ?? [],
      directMessages: directMessages ?? [],
      anonymousReports: anonymousReports ?? [],
    };
  });

export const createDirectorMessage = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => messageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);
    const target = normalizeTarget(data);

    const { data: message, error } = await supabaseAdmin
      .from("director_messages")
      .insert({
        ...target,
        created_by: context.userId,
        title: data.title,
        body: data.body,
        priority: data.priority,
      })
      .select("*")
      .single();

    if (error || !message)
      throw new Error(error?.message ?? "Não foi possível enviar o comunicado.");
    return { message };
  });

export const createDirectorAlert = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => alertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);
    const target = normalizeTarget(data);

    const { data: alert, error } = await supabaseAdmin
      .from("director_alerts")
      .insert({
        ...target,
        created_by: context.userId,
        title: data.title,
        body: data.body,
        tone: data.tone,
        active: data.active,
        expires_at: data.expiresAt ?? null,
      })
      .select("*")
      .single();

    if (error || !alert) throw new Error(error?.message ?? "Não foi possível criar o alerta.");
    return { alert };
  });

export const updateDirectorAlertStatus = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => alertStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);
    const { error } = await supabaseAdmin
      .from("director_alerts")
      .update({ active: data.active })
      .eq("id", data.alertId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendDirectorDirectMessage = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => directMessageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);

    const { data: message, error } = await supabaseAdmin
      .from("director_user_messages")
      .insert({
        user_id: data.userId,
        sender_id: context.userId,
        body: data.body,
      })
      .select("*")
      .single();

    if (error || !message) throw new Error(error?.message ?? "Não foi possível enviar a mensagem.");
    return { message };
  });

export const updateAnonymousReport = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => updateReportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);
    const { error } = await supabaseAdmin
      .from("anonymous_reports")
      .update({
        status: data.status,
        admin_notes: data.adminNotes ?? null,
      })
      .eq("id", data.reportId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDirectorInbox = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const now = new Date().toISOString();

    const [
      { data: roleRows },
      { data: studentClassRows },
      { data: teacherClassRows },
      { data: messages },
      { data: reads },
      { data: alerts },
      { data: directMessages },
    ] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin
        .from("class_members")
        .select("class_id")
        .eq("student_id", userId)
        .eq("status", "ativo"),
      supabaseAdmin
        .from("class_groups")
        .select("id")
        .eq("teacher_id", userId)
        .eq("status", "ativa"),
      supabaseAdmin
        .from("director_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80),
      supabaseAdmin.from("director_message_reads").select("*").eq("user_id", userId),
      supabaseAdmin
        .from("director_alerts")
        .select("*")
        .eq("active", true)
        .lte("starts_at", now)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("director_user_messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(100),
    ]);

    const roles = (roleRows ?? []).map((row) => row.role as AppRole);
    const classIds = new Set<string>([
      ...(studentClassRows ?? []).map((row) => row.class_id),
      ...(teacherClassRows ?? []).map((row) => row.id),
    ]);
    const readIds = new Set((reads ?? []).map((read) => read.message_id));

    const targetedMessages = ((messages ?? []) as Array<Tables<"director_messages">>).filter(
      (item) => isTargetedToUser(item, userId, roles, classIds),
    );
    const targetedAlerts = ((alerts ?? []) as Array<Tables<"director_alerts">>).filter((item) =>
      isTargetedToUser(item, userId, roles, classIds),
    );

    return {
      messages: targetedMessages.map((message) => ({
        ...message,
        read: readIds.has(message.id),
      })),
      alerts: targetedAlerts,
      directMessages: directMessages ?? [],
      unreadCount: targetedMessages.filter((message) => !readIds.has(message.id)).length,
    };
  });

export const markDirectorMessageRead = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => readSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("director_message_reads").upsert({
      message_id: data.messageId,
      user_id: context.userId,
      read_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const replyToDirector = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        body: z.string().trim().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: message, error } = await supabaseAdmin
      .from("director_user_messages")
      .insert({
        user_id: context.userId,
        sender_id: context.userId,
        body: data.body,
      })
      .select("*")
      .single();

    if (error || !message) throw new Error(error?.message ?? "Não foi possível enviar a resposta.");
    return { message };
  });

export const createAnonymousReport = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => reportSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("anonymous_reports").insert({
      category: data.category,
      title: data.title,
      body: data.body,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });
