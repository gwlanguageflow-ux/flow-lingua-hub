import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  getRequestMeta,
  writeSecurityEvent,
  writeUserSessionEvent,
} from "@/server/compliance.server";
import { checkRateLimit } from "@/server/rate-limit.server";
import { sanitizePath } from "@/lib/sanitize";

const securityEventSchema = z.object({
  eventType: z.string().trim().min(3).max(120),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).default("info"),
  route: z.string().trim().max(240).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  sessionId: z.string().trim().max(160).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const Route = createFileRoute("/api/public/security-event")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const meta = getRequestMeta(request);
        const limit = checkRateLimit(`security:${meta.ipAddress ?? "unknown"}`, 30, 60_000);
        if (!limit.allowed) return new Response("Rate limit exceeded", { status: 429 });

        const parsed = securityEventSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Invalid event", { status: 400 });

        await writeSecurityEvent({
          userId: parsed.data.userId ?? null,
          eventType: parsed.data.eventType,
          severity: parsed.data.severity,
          route: sanitizePath(parsed.data.route ?? meta.route),
          metadata: parsed.data.metadata,
          request,
        });

        if (parsed.data.eventType === "auth.login_success") {
          await writeUserSessionEvent({
            userId: parsed.data.userId ?? null,
            sessionId: parsed.data.sessionId ?? null,
            event: "login_success",
            metadata: parsed.data.metadata,
            request,
          });
        }

        if (parsed.data.eventType === "auth.login_failure") {
          await writeUserSessionEvent({
            sessionId: parsed.data.sessionId ?? null,
            event: "login_failure",
            metadata: parsed.data.metadata,
            request,
          });
        }

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
