import { createFileRoute } from "@tanstack/react-router";
import { writeAuditLog } from "@/server/compliance.server";
import { getComplianceDb } from "@/server/compliance-db.server";

function verifyCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return request.headers.get("user-agent")?.includes("vercel-cron") === true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export const Route = createFileRoute("/api/internal/lgpd-retention")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!verifyCron(request)) return new Response("Unauthorized", { status: 401 });
        const db = getComplianceDb();
        const { data, error } = await db.rpc("retention_cleanup_lgpd", { _dry_run: false });
        if (error) return new Response(error.message, { status: 500 });

        await writeAuditLog({
          action: "privacy.retention_cleanup_cron",
          entityType: "data_retention_rules",
          metadata: { result: data },
          request,
        });

        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
