import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  createAsaasPixAutomaticPayment,
  isAsaasPixAutomaticEnabled,
  requireAsaasConfig,
} from "@/server/asaas.server";

type PlanInterval = Database["public"]["Enums"]["plan_interval"];

function dateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addInterval(date: Date, interval: PlanInterval) {
  const end = new Date(date);
  if (interval === "mensal") end.setMonth(end.getMonth() + 1);
  else if (interval === "trimestral") end.setMonth(end.getMonth() + 3);
  else end.setFullYear(end.getFullYear() + 1);
  return end;
}

function verifyCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return request.headers.get("user-agent")?.includes("vercel-cron");
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function runRecurringPixBilling() {
  if (!isAsaasPixAutomaticEnabled()) {
    return { scanned: 0, created: 0, skipped: "Pix Automático não habilitado" };
  }
  requireAsaasConfig();
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 3);

  const { data: subscriptions, error } = await supabaseAdmin
    .from("student_subscriptions")
    .select(
      "id, asaas_customer_id, asaas_pix_authorization_id, current_period_end, plan:subscription_plans(price, interval)",
    )
    .eq("payment_method", "pix")
    .eq("status", "ativa")
    .not("asaas_customer_id", "is", null)
    .not("asaas_pix_authorization_id", "is", null)
    .lte("current_period_end", windowEnd.toISOString())
    .limit(50);

  if (error) throw error;

  let created = 0;
  for (const sub of subscriptions ?? []) {
    if (
      !sub.asaas_customer_id ||
      !sub.asaas_pix_authorization_id ||
      !sub.current_period_end ||
      !sub.plan
    ) {
      continue;
    }

    const periodStart = new Date(sub.current_period_end);
    const periodEnd = addInterval(periodStart, sub.plan.interval);
    const paymentReference = `asaas:scheduled:${sub.id}:${dateOnly(periodStart)}`;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("asaas_subscription_payments")
      .select("id")
      .eq("payment_reference", paymentReference)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) continue;

    const payment = await createAsaasPixAutomaticPayment({
      customerId: sub.asaas_customer_id,
      authorizationId: sub.asaas_pix_authorization_id,
      value: Number(sub.plan.price),
      dueDate: dateOnly(periodStart),
      description: "GWLanguageFlow assinatura",
      externalReference: `subscription:${sub.id}:${dateOnly(periodStart)}`,
    });

    const { error: insertError } = await supabaseAdmin.from("asaas_subscription_payments").insert({
      subscription_id: sub.id,
      asaas_payment_id: payment.id,
      payment_reference: `asaas:payment:${payment.id}`,
      amount: Number(sub.plan.price),
      status: payment.status ?? null,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      due_date: dateOnly(periodStart),
      invoice_url: payment.invoiceUrl ?? null,
      payload: payment as unknown as Json,
    });
    if (insertError) throw insertError;
    created += 1;
  }

  return { scanned: subscriptions?.length ?? 0, created };
}

export const Route = createFileRoute("/api/internal/asaas-recurring-billing")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!verifyCron(request)) return new Response("Unauthorized", { status: 401 });
        try {
          const result = await runRecurringPixBilling();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Erro ao gerar cobrancas recorrentes.";
          return new Response(message, { status: 500 });
        }
      },
    },
  },
});
