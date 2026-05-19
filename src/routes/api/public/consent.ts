import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  COOKIES_POLICY_VERSION,
  POLICY_VERSION,
  PRIVACY_POLICY_VERSION,
  defaultConsentCategories,
} from "@/lib/cookie-consent";
import { getRequestMeta, writeAuditLog } from "@/server/compliance.server";
import { getComplianceDb } from "@/server/compliance-db.server";
import { checkRateLimit } from "@/server/rate-limit.server";

const categorySchema = z.object({
  necessary: z.boolean().default(true),
  analytics: z.boolean().default(false),
  marketing: z.boolean().default(false),
  preferences: z.boolean().default(false),
  third_parties: z.boolean().default(false),
});

const consentSchema = z.object({
  visitorId: z.string().trim().min(8).max(100),
  categories: categorySchema.default(defaultConsentCategories),
  acceptedAll: z.boolean().default(false),
  rejectedAll: z.boolean().default(false),
});

export const Route = createFileRoute("/api/public/consent")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const meta = getRequestMeta(request);
        const limit = checkRateLimit(`consent:${meta.ipAddress ?? "unknown"}`, 40, 60_000);
        if (!limit.allowed) return new Response("Rate limit exceeded", { status: 429 });

        const parsed = consentSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid consent payload", { status: 400 });

        const categories = {
          ...parsed.data.categories,
          necessary: true,
        };
        const db = getComplianceDb();
        const { data, error } = await db
          .from<{ id: string; created_at: string }>("consents")
          .insert({
            visitor_id: parsed.data.visitorId,
            categories,
            policy_version: POLICY_VERSION,
            privacy_policy_version: PRIVACY_POLICY_VERSION,
            cookies_policy_version: COOKIES_POLICY_VERSION,
            accepted_all: parsed.data.acceptedAll,
            rejected_all: parsed.data.rejectedAll,
            source: "cookie_banner",
            ip_address: meta.ipAddress,
            user_agent: meta.userAgent,
          })
          .select("id, created_at")
          .single();

        if (error || !data) {
          return new Response("Could not store consent", { status: 500 });
        }

        await writeAuditLog({
          action: "privacy.cookie_consent_recorded",
          entityType: "consents",
          entityId: data.id,
          metadata: {
            visitorId: parsed.data.visitorId,
            acceptedAll: parsed.data.acceptedAll,
            rejectedAll: parsed.data.rejectedAll,
          },
          request,
        });

        return new Response(JSON.stringify({ ok: true, id: data.id, createdAt: data.created_at }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
