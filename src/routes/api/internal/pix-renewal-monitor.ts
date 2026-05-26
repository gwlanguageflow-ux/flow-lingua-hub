import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runValidapayPayoutRetry } from "@/server/validapay-payout-retry.server";

type PixSubscription = {
  id: string;
  student_id: string;
  status: "ativa" | "pendente" | "inadimplente" | "cancelada" | "expirada";
  current_period_end: string | null;
  plan: {
    name: string;
    interval: string;
  } | null;
};

const dayMs = 24 * 60 * 60 * 1000;

function verifyCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return request.headers.get("user-agent")?.includes("vercel-cron");
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function dayWindow(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function pluralDays(days: number) {
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

async function getDirectorUserId() {
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "dev")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (role?.user_id) return role.user_id;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", "gwlanguageflow@gmail.com")
    .maybeSingle();

  return profile?.id ?? null;
}

async function createDailyAlert(input: {
  createdBy: string;
  studentId: string;
  title: string;
  body: string;
  tone: "info" | "warning" | "urgent";
  now: Date;
}) {
  const { start, end } = dayWindow(input.now);
  const { data: existing, error: findError } = await supabaseAdmin
    .from("director_alerts")
    .select("id")
    .eq("target_type", "user")
    .eq("target_user_id", input.studentId)
    .eq("title", input.title)
    .gte("created_at", start)
    .lt("created_at", end)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return false;

  const expiresAt = new Date(input.now);
  expiresAt.setDate(expiresAt.getDate() + 1);

  const { error } = await supabaseAdmin.from("director_alerts").insert({
    created_by: input.createdBy,
    target_type: "user",
    target_user_id: input.studentId,
    title: input.title,
    body: input.body,
    tone: input.tone,
    active: true,
    starts_at: input.now.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  if (error) throw error;
  return true;
}

async function runPixRenewalMonitor() {
  const now = new Date();
  const fiveDaysFromNow = new Date(now.getTime() + 5 * dayMs);
  const directorId = await getDirectorUserId();

  if (!directorId) {
    return { expired: 0, reminders: 0, skipped: "Diretoria não encontrada" };
  }

  const { data: expiredSubs, error: expiredError } = await supabaseAdmin
    .from("student_subscriptions")
    .select("id, student_id, status, current_period_end, plan:subscription_plans(name, interval)")
    .eq("payment_method", "pix")
    .eq("status", "ativa")
    .not("current_period_end", "is", null)
    .lte("current_period_end", now.toISOString());

  if (expiredError) throw expiredError;

  const expired = ((expiredSubs ?? []) as unknown as PixSubscription[]).filter(
    (sub) => !!sub.current_period_end,
  );

  if (expired.length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from("student_subscriptions")
      .update({ status: "inadimplente", updated_at: now.toISOString() })
      .in(
        "id",
        expired.map((sub) => sub.id),
      );
    if (updateError) throw updateError;
  }

  let expiredAlerts = 0;
  for (const sub of expired) {
    const created = await createDailyAlert({
      createdBy: directorId,
      studentId: sub.student_id,
      title: "Sua assinatura venceu",
      body: "Seu plano por PIX chegou ao vencimento. Acesse Minha assinatura e faça um novo pagamento para reativar o agendamento.",
      tone: "urgent",
      now,
    });
    if (created) expiredAlerts += 1;
  }

  const { data: dueSoonSubs, error: dueSoonError } = await supabaseAdmin
    .from("student_subscriptions")
    .select("id, student_id, status, current_period_end, plan:subscription_plans(name, interval)")
    .eq("payment_method", "pix")
    .eq("status", "ativa")
    .not("current_period_end", "is", null)
    .gt("current_period_end", now.toISOString())
    .lte("current_period_end", fiveDaysFromNow.toISOString());

  if (dueSoonError) throw dueSoonError;

  let reminderAlerts = 0;
  for (const sub of ((dueSoonSubs ?? []) as unknown as PixSubscription[]).filter(
    (item) => !!item.current_period_end,
  )) {
    const periodEnd = new Date(sub.current_period_end!);
    const daysLeft = Math.max(1, Math.ceil((periodEnd.getTime() - now.getTime()) / dayMs));
    const created = await createDailyAlert({
      createdBy: directorId,
      studentId: sub.student_id,
      title: `Sua assinatura vence em ${pluralDays(daysLeft)}`,
      body: `Falta pouco para vencer seu plano ${sub.plan?.name ?? "GWLanguageFlow"} pago por PIX. No vencimento, acesse Minha assinatura e pague novamente para manter seu acesso.`,
      tone: daysLeft <= 1 ? "urgent" : "warning",
      now,
    });
    if (created) reminderAlerts += 1;
  }

  return {
    expired: expired.length,
    expiredAlerts,
    reminders: reminderAlerts,
    scannedDueSoon: dueSoonSubs?.length ?? 0,
  };
}

export const Route = createFileRoute("/api/internal/pix-renewal-monitor")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!verifyCron(request)) return new Response("Unauthorized", { status: 401 });
        try {
          const [pixRenewal, payoutRetry] = await Promise.all([
            runPixRenewalMonitor(),
            runValidapayPayoutRetry(),
          ]);
          const result = { pixRenewal, payoutRetry };
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Erro ao monitorar renovacoes por PIX.";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
