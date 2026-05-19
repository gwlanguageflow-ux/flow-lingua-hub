import { getRequest } from "@tanstack/react-start/server";
import { sanitizePath, sanitizeText } from "@/lib/sanitize";
import { getComplianceDb } from "@/server/compliance-db.server";

export type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
  route: string | null;
};

function normalizeIp(value: string | null) {
  const ip = value?.split(",")[0]?.trim() ?? "";
  if (!ip || ip.length > 80 || /\s/.test(ip)) return null;
  return ip;
}

export function getRequestMeta(request?: Request): RequestMeta {
  const activeRequest = request ?? getRequest();
  const headers = activeRequest?.headers;
  const url = activeRequest?.url ? new URL(activeRequest.url) : null;

  return {
    ipAddress: normalizeIp(
      headers?.get("x-forwarded-for") ??
        headers?.get("x-real-ip") ??
        headers?.get("cf-connecting-ip"),
    ),
    userAgent: sanitizeText(headers?.get("user-agent") ?? "", 500) || null,
    route: url ? sanitizePath(url.pathname) : null,
  };
}

export async function writeAuditLog(input: {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  request?: Request;
}) {
  const meta = getRequestMeta(input.request);
  const db = getComplianceDb();
  await db.from("audit_logs").insert({
    actor_user_id: input.actorUserId ?? null,
    actor_role: input.actorRole ?? null,
    action: sanitizeText(input.action, 120),
    entity_type: sanitizeText(input.entityType, 120),
    entity_id: input.entityId ? sanitizeText(input.entityId, 160) : null,
    metadata: input.metadata ?? {},
    ip_address: meta.ipAddress,
    user_agent: meta.userAgent,
  });
}

export async function writeSecurityEvent(input: {
  userId?: string | null;
  eventType: string;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  route?: string | null;
  metadata?: Record<string, unknown>;
  request?: Request;
}) {
  const meta = getRequestMeta(input.request);
  const db = getComplianceDb();
  await db.from("security_events").insert({
    user_id: input.userId ?? null,
    event_type: sanitizeText(input.eventType, 120),
    severity: input.severity ?? "info",
    route: sanitizePath(input.route ?? meta.route),
    metadata: input.metadata ?? {},
    ip_address: meta.ipAddress,
    user_agent: meta.userAgent,
  });
}

export async function writeUserSessionEvent(input: {
  userId?: string | null;
  sessionId?: string | null;
  event: "login_success" | "login_failure" | "logout" | "password_reset" | "session_refreshed";
  metadata?: Record<string, unknown>;
  request?: Request;
}) {
  const meta = getRequestMeta(input.request);
  const db = getComplianceDb();
  await db.from("user_sessions").insert({
    user_id: input.userId ?? null,
    session_id: input.sessionId ?? null,
    event: input.event,
    metadata: input.metadata ?? {},
    ip_address: meta.ipAddress,
    user_agent: meta.userAgent,
  });
}

export function generatePrivacyProtocol() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8).toUpperCase()
      : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `LGPD-${date}-${suffix}`;
}
