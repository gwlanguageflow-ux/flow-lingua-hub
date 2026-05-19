import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import { getAsaasWebhookToken } from "@/server/asaas.server";
import { writeSecurityEvent } from "@/server/compliance.server";

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];
type WithdrawalStatus = Database["public"]["Enums"]["teacher_withdrawal_status"];
type PlanInterval = Database["public"]["Enums"]["plan_interval"];

type AsaasPaymentPayload = {
  id?: string | null;
  status?: string | null;
  value?: number | null;
  externalReference?: string | null;
  paymentDate?: string | null;
  confirmedDate?: string | null;
  clientPaymentDate?: string | null;
  pixTransaction?: {
    conciliationIdentifier?: string | null;
  } | null;
  pixAutomaticAuthorization?: string | { id?: string | null } | null;
  pixAutomaticAuthorizationId?: string | null;
};

type AsaasAuthorizationPayload = {
  id?: string | null;
  status?: string | null;
  contractId?: string | null;
};

type AsaasTransferPayload = {
  id?: string | null;
  status?: string | null;
  externalReference?: string | null;
  transactionReceiptUrl?: string | null;
  failReason?: string | null;
};

type AsaasWebhookPayload = {
  id?: string | null;
  event?: string | null;
  payment?: AsaasPaymentPayload | null;
  transfer?: AsaasTransferPayload | null;
  pixAutomaticAuthorization?: AsaasAuthorizationPayload | null;
  authorization?: AsaasAuthorizationPayload | null;
  [key: string]: unknown;
};

function asaasId(value: string | { id?: string | null } | null | undefined) {
  return typeof value === "string" ? value : (value?.id ?? null);
}

function eventKey(payload: AsaasWebhookPayload, raw: string) {
  const objectId =
    payload.payment?.id ??
    payload.transfer?.id ??
    payload.pixAutomaticAuthorization?.id ??
    payload.authorization?.id ??
    payload.id;
  if (payload.event && objectId) return `${payload.event}:${objectId}`;
  return `raw:${createHash("sha256").update(raw).digest("hex")}`;
}

function addInterval(date: Date, interval: PlanInterval) {
  const end = new Date(date);
  if (interval === "mensal") end.setMonth(end.getMonth() + 1);
  else if (interval === "trimestral") end.setMonth(end.getMonth() + 3);
  else end.setFullYear(end.getFullYear() + 1);
  return end;
}

function subscriptionIdFromExternalReference(value: string | null | undefined) {
  const match = value?.match(/^subscription:([0-9a-f-]{36})(?::.+)?$/i);
  return match?.[1] ?? null;
}

function mapSubscriptionStatus(status: string | null | undefined): SubscriptionStatus {
  if (status === "CANCELLED" || status === "EXPIRED") return "cancelada";
  if (status === "OVERDUE" || status === "REFUNDED" || status === "CHARGEBACK_REQUESTED") {
    return "inadimplente";
  }
  return "pendente";
}

function mapTransferStatus(status: string | null | undefined): WithdrawalStatus {
  if (status === "DONE") return "pago";
  if (status === "CANCELLED") return "cancelado";
  if (status === "FAILED") return "falhou";
  return "em_processamento";
}

function isFailedTransferStatus(status: WithdrawalStatus) {
  return status === "falhou" || status === "cancelado";
}

function transferFailureMessage(status: WithdrawalStatus, failReason?: string | null) {
  if (!isFailedTransferStatus(status)) return null;
  return (
    failReason ??
    (status === "cancelado" ? "Transferencia Pix cancelada" : "Transferencia Pix falhou")
  );
}

async function activateSubscription(
  subscriptionId: string,
  paymentReference: string,
  paidAt?: string | null,
) {
  const { data: sub, error } = await supabaseAdmin
    .from("student_subscriptions")
    .select("id, plan:subscription_plans(interval)")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (error) throw error;
  if (!sub) return;

  const paidDate = paidAt ? new Date(paidAt) : new Date();
  const interval = sub.plan?.interval ?? "mensal";
  const periodEnd = addInterval(paidDate, interval);

  const { error: rpcError } = await supabaseAdmin.rpc("activate_paid_student_subscription", {
    _subscription_id: subscriptionId,
    _stripe_subscription_id: null,
    _period_start: paidDate.toISOString(),
    _period_end: periodEnd.toISOString(),
    _payment_reference: paymentReference,
  });
  if (rpcError) throw rpcError;
}

async function findSubscriptionForPayment(payment: AsaasPaymentPayload) {
  const byExternalReference = subscriptionIdFromExternalReference(payment.externalReference);
  if (byExternalReference) return byExternalReference;

  const authId =
    asaasId(payment.pixAutomaticAuthorization) ?? payment.pixAutomaticAuthorizationId ?? null;
  const conciliationId = payment.pixTransaction?.conciliationIdentifier ?? null;

  const query = supabaseAdmin
    .from("student_subscriptions")
    .select("id")
    .or(
      [
        payment.id ? `asaas_payment_id.eq.${payment.id}` : null,
        authId ? `asaas_pix_authorization_id.eq.${authId}` : null,
        conciliationId ? `asaas_pix_conciliation_id.eq.${conciliationId}` : null,
      ]
        .filter(Boolean)
        .join(","),
    )
    .limit(1)
    .maybeSingle();

  const { data, error } = await query;
  if (error) throw error;
  return data?.id ?? null;
}

async function handlePayment(event: string, payment: AsaasPaymentPayload) {
  if (!payment.id) return;

  const subscriptionId = await findSubscriptionForPayment(payment);
  if (!subscriptionId) return;

  await supabaseAdmin
    .from("student_subscriptions")
    .update({
      asaas_payment_id: payment.id,
      asaas_payment_status: payment.status ?? null,
    })
    .eq("id", subscriptionId);

  await supabaseAdmin
    .from("asaas_subscription_payments")
    .update({
      status: payment.status ?? null,
      payload: payment,
    })
    .eq("asaas_payment_id", payment.id);

  if (
    event === "PAYMENT_RECEIVED" ||
    event === "PAYMENT_CONFIRMED" ||
    payment.status === "RECEIVED" ||
    payment.status === "CONFIRMED"
  ) {
    await activateSubscription(
      subscriptionId,
      `asaas:payment:${payment.id}`,
      payment.paymentDate ?? payment.confirmedDate ?? payment.clientPaymentDate ?? null,
    );
    return;
  }

  if (event === "PAYMENT_OVERDUE" || event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
    await supabaseAdmin
      .from("student_subscriptions")
      .update({
        status: mapSubscriptionStatus(payment.status),
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscriptionId);
  }
}

async function handleAuthorization(event: string, authorization: AsaasAuthorizationPayload) {
  if (!authorization.id && !authorization.contractId) return;

  const { data: sub, error } = await supabaseAdmin
    .from("student_subscriptions")
    .select("id, last_payment_at")
    .or(
      [
        authorization.id ? `asaas_pix_authorization_id.eq.${authorization.id}` : null,
        authorization.contractId ? `asaas_pix_contract_id.eq.${authorization.contractId}` : null,
      ]
        .filter(Boolean)
        .join(","),
    )
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!sub) return;

  await supabaseAdmin
    .from("student_subscriptions")
    .update({
      asaas_pix_authorization_status: authorization.status ?? event,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  if (!sub.last_payment_at && event.includes("ACTIVATED") && authorization.id) {
    await activateSubscription(sub.id, `asaas:authorization:${authorization.id}:initial`);
  }
}

async function handleTransfer(transfer: AsaasTransferPayload) {
  if (!transfer.id && !transfer.externalReference) return;
  const status = mapTransferStatus(transfer.status);
  const now = new Date().toISOString();
  const teacherMatch = transfer.externalReference?.match(/^teacher-withdrawal:([0-9a-f-]{36})$/i);
  const platformMatch = transfer.externalReference?.match(/^platform-withdrawal:([0-9a-f-]{36})$/i);

  if (teacherMatch) {
    const withdrawalId = teacherMatch[1];
    const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
      .from("teacher_withdrawal_requests")
      .select("id, teacher_id, amount, status")
      .eq("id", withdrawalId)
      .maybeSingle();
    if (withdrawalError) throw withdrawalError;

    await supabaseAdmin
      .from("teacher_withdrawal_requests")
      .update({
        status,
        payout_external_id: transfer.id ?? null,
        payout_external_status: transfer.status ?? null,
        payout_receipt_url: transfer.transactionReceiptUrl ?? null,
        payout_error: transferFailureMessage(status, transfer.failReason),
        processed_at: now,
        paid_at: status === "pago" ? now : null,
      })
      .eq("id", withdrawalId);

    if (withdrawal && isFailedTransferStatus(status)) {
      const { data: reversal } = await supabaseAdmin
        .from("teacher_wallet_transactions")
        .select("id")
        .eq("withdrawal_request_id", withdrawal.id)
        .eq("transaction_type", "withdrawal_reversal")
        .maybeSingle();

      if (!reversal) {
        await supabaseAdmin.from("teacher_wallet_transactions").insert({
          teacher_id: withdrawal.teacher_id,
          withdrawal_request_id: withdrawal.id,
          transaction_type: "withdrawal_reversal",
          amount: Number(withdrawal.amount),
          description: "Reversao automatica de saque Pix nao concluido",
          created_by: withdrawal.teacher_id,
        });
      }
    }
  }

  if (platformMatch) {
    const withdrawalId = platformMatch[1];
    const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
      .from("platform_withdrawal_requests")
      .select("id, amount, status, requested_by")
      .eq("id", withdrawalId)
      .maybeSingle();
    if (withdrawalError) throw withdrawalError;

    await supabaseAdmin
      .from("platform_withdrawal_requests")
      .update({
        status,
        payout_external_id: transfer.id ?? null,
        payout_external_status: transfer.status ?? null,
        payout_receipt_url: transfer.transactionReceiptUrl ?? null,
        payout_error: transferFailureMessage(status, transfer.failReason),
        processed_at: now,
        paid_at: status === "pago" ? now : null,
      })
      .eq("id", withdrawalId);

    if (
      withdrawal &&
      isFailedTransferStatus(status) &&
      !isFailedTransferStatus(withdrawal.status)
    ) {
      await supabaseAdmin.from("platform_wallet_transactions").insert({
        transaction_type: "manual_adjustment",
        amount: Number(withdrawal.amount),
        gross_amount: null,
        fee_rate: 0.1,
        description: `Reversao automatica de saque da diretoria ${withdrawal.id}`,
        created_by: withdrawal.requested_by,
      });
    }
  }
}

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expectedToken = getAsaasWebhookToken();
        const receivedToken = request.headers.get("asaas-access-token") ?? "";
        if (expectedToken && receivedToken !== expectedToken) {
          await writeSecurityEvent({
            eventType: "asaas.webhook_invalid_token",
            severity: "high",
            route: "/api/public/asaas-webhook",
            request,
          });
          return new Response("Invalid token", { status: 401 });
        }

        const raw = await request.text();
        let payload: AsaasWebhookPayload;
        try {
          payload = JSON.parse(raw || "{}") as AsaasWebhookPayload;
        } catch (err) {
          await writeSecurityEvent({
            eventType: "asaas.webhook_invalid_json",
            severity: "medium",
            route: "/api/public/asaas-webhook",
            metadata: { message: err instanceof Error ? err.message : "invalid json" },
            request,
          });
          return new Response("Invalid JSON", { status: 400 });
        }
        const key = eventKey(payload, raw);
        const { data: eventRow, error: insertError } = await supabaseAdmin
          .from("asaas_webhook_events")
          .insert({
            event_key: key,
            event_type: payload.event ?? null,
            payload: payload as unknown as Json,
          })
          .select("id")
          .single();

        if (insertError) {
          if (insertError.code === "23505") {
            return new Response(JSON.stringify({ received: true, duplicate: true }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
          throw insertError;
        }

        try {
          const event = payload.event ?? "";
          if (payload.payment) await handlePayment(event, payload.payment);
          if (payload.transfer) await handleTransfer(payload.transfer);
          const authorization = payload.pixAutomaticAuthorization ?? payload.authorization ?? null;
          if (authorization) await handleAuthorization(event, authorization);

          await supabaseAdmin
            .from("asaas_webhook_events")
            .update({ processed_at: new Date().toISOString(), processing_error: null })
            .eq("id", eventRow.id);
        } catch (err) {
          const message = err instanceof Error ? err.message : "Erro ao processar webhook Asaas.";
          await writeSecurityEvent({
            eventType: "asaas.webhook_handler_error",
            severity: "high",
            route: "/api/public/asaas-webhook",
            metadata: { message },
            request,
          });
          await supabaseAdmin
            .from("asaas_webhook_events")
            .update({ processing_error: message.slice(0, 1000) })
            .eq("id", eventRow.id);
          return new Response("Handler error", { status: 500 });
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
