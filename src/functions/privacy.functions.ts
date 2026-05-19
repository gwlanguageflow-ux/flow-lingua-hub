import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { sanitizeNullableText, sanitizeText } from "@/lib/sanitize";
import {
  COOKIES_POLICY_VERSION,
  POLICY_VERSION,
  PRIVACY_POLICY_VERSION,
  defaultConsentCategories,
} from "@/lib/cookie-consent";
import {
  generatePrivacyProtocol,
  writeAuditLog,
  writeSecurityEvent,
  writeUserSessionEvent,
} from "@/server/compliance.server";
import { getComplianceDb } from "@/server/compliance-db.server";

type ProfileSummary = {
  full_name?: string | null;
  email?: string | null;
};

type DataRow = {
  [key: string]: Json | undefined;
};

type PrivacyRequestRow = {
  id: string;
  protocol: string;
  user_id: string | null;
  request_type: string;
  description: string;
  status: string;
  admin_response?: string | null;
  created_at?: string;
};

const privacyRequestSchema = z.object({
  requestType: z.enum([
    "access",
    "export",
    "correction",
    "deletion",
    "anonymization",
    "consent_revocation",
    "portability",
    "opposition",
    "information",
    "other",
  ]),
  description: z.string().trim().min(5).max(5000),
  requesterEmail: z.string().trim().email().max(255).optional().nullable(),
  requesterName: z.string().trim().min(2).max(160).optional().nullable(),
});

const adminUpdateSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["open", "in_review", "waiting_user", "completed", "rejected", "cancelled"]),
  adminResponse: z.string().trim().min(3).max(5000),
});

const adminActionSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["export", "anonymize"]),
  reason: z.string().trim().min(3).max(500).optional().nullable(),
});

const retentionSchema = z.object({
  dryRun: z.boolean().default(true),
});

async function requireDirector(userId: string) {
  const db = getComplianceDb();
  const { data: role, error } = await db
    .from<{ id: string }>("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "dev")
    .maybeSingle();

  if (error || !role) {
    await writeSecurityEvent({
      userId,
      eventType: "admin_lgpd_forbidden",
      severity: "medium",
      route: "/admin/lgpd",
    });
    throw new Response("Forbidden", { status: 403 });
  }

  return db;
}

async function collectUserData(userId: string) {
  const db = getComplianceDb();

  const [
    profile,
    roles,
    studentProfile,
    teacherProfile,
    bookingsAsStudent,
    bookingsAsTeacher,
    subscriptions,
    classMemberships,
    classGroups,
    teacherWallet,
    platformWallet,
    directorMessages,
    teacherStudentMessages,
    consents,
    privacyRequests,
    sessions,
  ] = await Promise.all([
    db
      .from<DataRow>("profiles")
      .select("id, full_name, email, age, avatar_url, created_at, updated_at")
      .eq("id", userId)
      .maybeSingle(),
    db.from<DataRow[]>("user_roles").select("role, created_at").eq("user_id", userId),
    db.from<DataRow>("student_profiles").select("*").eq("id", userId).maybeSingle(),
    db.from<DataRow>("teacher_profiles").select("*").eq("id", userId).maybeSingle(),
    db
      .from<DataRow[]>("bookings")
      .select("id, teacher_id, scheduled_at, duration_minutes, status, notes, created_at")
      .eq("student_id", userId)
      .order("scheduled_at", { ascending: false })
      .limit(100),
    db
      .from<DataRow[]>("bookings")
      .select("id, student_id, scheduled_at, duration_minutes, status, notes, created_at")
      .eq("teacher_id", userId)
      .order("scheduled_at", { ascending: false })
      .limit(100),
    db
      .from<DataRow[]>("student_subscriptions")
      .select(
        "id, plan_id, teacher_id, status, payment_method, current_period_start, current_period_end, cancel_at_period_end, last_payment_at, terms_accepted_at, terms_version, created_at, subscription_plans(name, price, interval)",
      )
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from<DataRow[]>("class_members")
      .select("id, class_id, status, joined_at, created_at")
      .eq("student_id", userId)
      .limit(100),
    db
      .from<DataRow[]>("class_groups")
      .select("id, name, language, level, status, created_at")
      .eq("teacher_id", userId)
      .limit(100),
    db
      .from<DataRow[]>("teacher_wallet_transactions")
      .select("id, amount, gross_amount, platform_fee, transaction_type, description, created_at")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from<DataRow[]>("platform_wallet_transactions")
      .select("id, amount, gross_amount, transaction_type, description, created_at")
      .or(`student_id.eq.${userId},teacher_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from<DataRow[]>("director_user_messages")
      .select("id, sender_id, body, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from<DataRow[]>("teacher_student_messages")
      .select("id, teacher_id, student_id, sender_id, body, read_at, created_at")
      .or(`sender_id.eq.${userId},student_id.eq.${userId},teacher_id.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from<DataRow[]>("consents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from<DataRow[]>("privacy_requests")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from<DataRow[]>("user_sessions")
      .select("event, session_id, created_at, user_agent")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return {
    profile: profile.data ?? null,
    roles: roles.data ?? [],
    studentProfile: studentProfile.data ?? null,
    teacherProfile: teacherProfile.data ?? null,
    bookingsAsStudent: bookingsAsStudent.data ?? [],
    bookingsAsTeacher: bookingsAsTeacher.data ?? [],
    subscriptions: subscriptions.data ?? [],
    classMemberships: classMemberships.data ?? [],
    classGroups: classGroups.data ?? [],
    teacherWallet: teacherWallet.data ?? [],
    platformWallet: platformWallet.data ?? [],
    directorMessages: directorMessages.data ?? [],
    teacherStudentMessages: teacherStudentMessages.data ?? [],
    consents: consents.data ?? [],
    privacyRequests: privacyRequests.data ?? [],
    sessions: sessions.data ?? [],
  };
}

export const getPrivacyCenterData = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = getComplianceDb();
    const [data, policies, rules] = await Promise.all([
      collectUserData(context.userId),
      db
        .from<DataRow[]>("policy_versions")
        .select("slug, version, title, effective_at")
        .eq("is_active", true)
        .order("effective_at", { ascending: false }),
      db
        .from<DataRow[]>("data_retention_rules")
        .select("data_category, legal_basis, retention_period, action, description")
        .eq("is_active", true)
        .order("data_category"),
    ]);

    return {
      ...data,
      policyVersions: policies.data ?? [],
      retentionRules: rules.data ?? [],
    };
  });

export const submitPrivacyRequest = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => privacyRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = getComplianceDb();
    const { data: profile } = await db
      .from<ProfileSummary>("profiles")
      .select("full_name, email")
      .eq("id", context.userId)
      .maybeSingle();

    const protocol = generatePrivacyProtocol();
    const { data: requestRow, error } = await db
      .from<PrivacyRequestRow>("privacy_requests")
      .insert({
        protocol,
        user_id: context.userId,
        request_type: data.requestType,
        requester_name: sanitizeNullableText(data.requesterName ?? profile?.full_name, 160),
        requester_email: sanitizeNullableText(data.requesterEmail ?? profile?.email, 255),
        description: sanitizeText(data.description, 5000),
        payload: { source: "privacy_center", policyVersion: POLICY_VERSION },
      })
      .select("*")
      .single();

    if (error || !requestRow) {
      throw new Error(error?.message ?? "Nao foi possivel registrar a solicitacao LGPD.");
    }

    await writeAuditLog({
      actorUserId: context.userId,
      action: "privacy.request_created",
      entityType: "privacy_requests",
      entityId: requestRow.id,
      metadata: { protocol, requestType: data.requestType },
    });

    return { request: requestRow };
  });

export const revokeUserConsent = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = getComplianceDb();
    const now = new Date().toISOString();

    await db
      .from("consents")
      .update({ revoked_at: now })
      .eq("user_id", context.userId)
      .is("revoked_at", null);

    const { data: consent, error } = await db
      .from<{ id: string }>("consents")
      .insert({
        user_id: context.userId,
        categories: defaultConsentCategories,
        policy_version: POLICY_VERSION,
        privacy_policy_version: PRIVACY_POLICY_VERSION,
        cookies_policy_version: COOKIES_POLICY_VERSION,
        accepted_all: false,
        rejected_all: true,
        source: "privacy_center",
        revoked_at: now,
      })
      .select("*")
      .single();

    if (error || !consent) {
      throw new Error(error?.message ?? "Nao foi possivel revogar o consentimento.");
    }

    await writeAuditLog({
      actorUserId: context.userId,
      action: "privacy.consent_revoked",
      entityType: "consents",
      entityId: consent.id,
      metadata: { policyVersion: POLICY_VERSION },
    });

    return { consent };
  });

export const recordAuthenticatedLogout = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    await writeUserSessionEvent({ userId: context.userId, event: "logout" });
    await writeAuditLog({
      actorUserId: context.userId,
      action: "auth.logout",
      entityType: "user_sessions",
      metadata: {},
    });
    return { ok: true };
  });

export const getLgpdAdminDashboard = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await requireDirector(context.userId);

    const [requests, auditLogs, securityEvents, policyVersions, retentionRules, consents] =
      await Promise.all([
        db
          .from<DataRow[]>("privacy_requests")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        db
          .from<DataRow[]>("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        db
          .from<DataRow[]>("security_events")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        db
          .from<DataRow[]>("policy_versions")
          .select("*")
          .order("effective_at", { ascending: false })
          .limit(50),
        db
          .from<DataRow[]>("data_retention_rules")
          .select("*")
          .order("data_category", { ascending: true })
          .limit(100),
        db
          .from<DataRow[]>("consents")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

    await writeAuditLog({
      actorUserId: context.userId,
      actorRole: "dev",
      action: "admin.lgpd_dashboard_access",
      entityType: "privacy_admin",
      metadata: { requestCount: requests.data?.length ?? 0 },
    });

    return {
      privacyRequests: requests.data ?? [],
      auditLogs: auditLogs.data ?? [],
      securityEvents: securityEvents.data ?? [],
      policyVersions: policyVersions.data ?? [],
      retentionRules: retentionRules.data ?? [],
      consents: consents.data ?? [],
    };
  });

export const updatePrivacyRequestAdmin = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => adminUpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await requireDirector(context.userId);
    const completedAt = data.status === "completed" ? new Date().toISOString() : null;
    const { data: updated, error } = await db
      .from<PrivacyRequestRow>("privacy_requests")
      .update({
        status: data.status,
        admin_response: sanitizeText(data.adminResponse, 5000),
        assigned_to: context.userId,
        completed_at: completedAt,
      })
      .eq("id", data.requestId)
      .select("*")
      .single();

    if (error || !updated) throw new Error(error?.message ?? "Nao foi possivel atualizar.");

    await writeAuditLog({
      actorUserId: context.userId,
      actorRole: "dev",
      action: "privacy.request_admin_response",
      entityType: "privacy_requests",
      entityId: data.requestId,
      metadata: { status: data.status },
    });

    return { request: updated };
  });

export const runPrivacyRequestAdminAction = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => adminActionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await requireDirector(context.userId);
    const { data: requestRow, error } = await db
      .from<PrivacyRequestRow>("privacy_requests")
      .select("*")
      .eq("id", data.requestId)
      .single();
    if (error || !requestRow) throw new Error(error?.message ?? "Solicitacao nao encontrada.");
    if (!requestRow.user_id) throw new Error("Solicitacao sem usuario vinculado.");

    if (data.action === "export") {
      const exportData = await collectUserData(requestRow.user_id);
      await db
        .from("privacy_requests")
        .update({
          response_payload: { export: exportData, exportedAt: new Date().toISOString() },
          admin_response: "Exportacao de dados gerada pela Diretoria.",
          assigned_to: context.userId,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", data.requestId);

      await writeAuditLog({
        actorUserId: context.userId,
        actorRole: "dev",
        action: "privacy.data_exported",
        entityType: "privacy_requests",
        entityId: data.requestId,
        metadata: { subjectUserId: requestRow.user_id },
      });

      return { action: "export", exportData };
    }

    const { data: anonymized, error: rpcError } = await db.rpc<Json>("anonymize_profile_lgpd", {
      _target_user_id: requestRow.user_id,
      _actor_user_id: context.userId,
      _reason: sanitizeText(data.reason ?? requestRow.description, 500),
    });
    if (rpcError) throw new Error(rpcError.message);

    await db
      .from("privacy_requests")
      .update({
        response_payload: { anonymized, anonymizedAt: new Date().toISOString() },
        admin_response: "Anonimizacao executada conforme solicitacao e regras de retencao.",
        assigned_to: context.userId,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", data.requestId);

    await writeAuditLog({
      actorUserId: context.userId,
      actorRole: "dev",
      action: "privacy.user_anonymized",
      entityType: "privacy_requests",
      entityId: data.requestId,
      metadata: { subjectUserId: requestRow.user_id },
    });

    return { action: "anonymize", anonymized: anonymized ?? null };
  });

export const runLgpdRetentionCleanup = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => retentionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const db = await requireDirector(context.userId);
    const { data: result, error } = await db.rpc<Json>("retention_cleanup_lgpd", {
      _dry_run: data.dryRun,
    });
    if (error) throw new Error(error.message);

    await writeAuditLog({
      actorUserId: context.userId,
      actorRole: "dev",
      action: data.dryRun ? "privacy.retention_dry_run" : "privacy.retention_cleanup",
      entityType: "data_retention_rules",
      metadata: { result },
    });

    return { result: result ?? null };
  });
