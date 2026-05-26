import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import { writeSecurityEvent } from "@/server/compliance.server";
import { getValidapayWebhookSecret } from "@/server/validapay.server";

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];
type ValidapayWebhookPayload = {
  event?: string;
  id?: string;
  chargeId?: string;
  amount?: number;
  paymentMethod?: string;
  paymentId?: string;
  paidAt?: string;
  subscriptionId?: string;
  checkoutSessionId?: string;
  sessionId?: string;
  customerId?: string;
  metadata?: Record<string, unknown> | null;
  payer?: {
    taxId?: string;
    name?: string;
  };
  [key: string]: unknown;
};

type ActivateSubscriptionArgs =
  Database["public"]["Functions"]["activate_paid_student_subscription"]["Args"];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickStringDeep(value: unknown, keys: string[], maxDepth = 4): string | null {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const seen = new Set<unknown>();

  function visit(current: unknown, depth: number): string | null {
    if (depth > maxDepth || seen.has(current)) return null;
    const record = asRecord(current);
    if (!record) return null;
    seen.add(current);

    for (const [key, nested] of Object.entries(record)) {
      if (wanted.has(key.toLowerCase()) && typeof nested === "string" && nested.trim()) {
        return nested.trim();
      }
    }

    for (const nested of Object.values(record)) {
      const found = visit(nested, depth + 1);
      if (found) return found;
    }

    return null;
  }

  return visit(value, 0);
}

function onlyDigits(value: string | null | undefined) {
  return value?.replace(/\D/g, "") ?? "";
}

function paymentMethodFromPayload(method: string | null | undefined) {
  const normalized = method?.toLowerCase();
  if (normalized?.includes("pix")) return "pix";
  if (normalized?.includes("card") || normalized?.includes("credit")) return "card";
  return null;
}

function periodStart(payload: ValidapayWebhookPayload) {
  const date = payload.paidAt ? new Date(payload.paidAt) : new Date();
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function paymentReference(payload: ValidapayWebhookPayload) {
  return (
    payload.paymentId ??
    payload.chargeId ??
    payload.checkoutSessionId ??
    payload.sessionId ??
    payload.subscriptionId ??
    payload.id ??
    null
  );
}

function normalizeProviderEvent(event: string | null | undefined) {
  const normalized = (event ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".");

  if (
    /(payment|pagamento|cobranca)/.test(normalized) &&
    /(success|approved|aprovad|paid|confirmad|recebid)/.test(normalized)
  ) {
    return "payment.success";
  }

  if (
    /(payment|pagamento|cobranca)/.test(normalized) &&
    /(fail|failed|recusad|rejected|cancelad|negad)/.test(normalized)
  ) {
    return "payment.failed";
  }

  if (
    /(subscription|assinatura)/.test(normalized) &&
    /(active|ativad|created|criad)/.test(normalized)
  ) {
    return "subscription.activated";
  }

  if (/(subscription|assinatura)/.test(normalized) && /(renew|renovad)/.test(normalized)) {
    return "subscription.renewed";
  }

  if (/(subscription|assinatura)/.test(normalized) && /(cancel|cancelad)/.test(normalized)) {
    return "subscription.canceled";
  }

  return normalized || "unknown";
}

async function activatePaidSubscription(args: ActivateSubscriptionArgs) {
  const { error } = await supabaseAdmin.rpc("activate_paid_student_subscription", args);
  if (!error) return;

  const canRetryLegacy =
    "_payment_reference" in args &&
    (error.code === "PGRST202" ||
      /payment_reference|schema cache|function .*activate_paid_student_subscription/i.test(
        error.message,
      ));

  if (!canRetryLegacy) throw error;

  const { _payment_reference: _ignored, ...legacyArgs } = args;
  const { error: legacyError } = await supabaseAdmin.rpc(
    "activate_paid_student_subscription",
    legacyArgs,
  );
  if (legacyError) throw legacyError;
}

function addPlanInterval(startIso: string, interval: string | null | undefined) {
  const end = new Date(startIso);
  if (!Number.isFinite(end.getTime())) return null;

  if (interval === "trimestral") {
    end.setMonth(end.getMonth() + 3);
  } else if (interval === "anual") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }

  return end.toISOString();
}

async function getSubscriptionPeriodEnd(subscriptionId: string, startIso: string) {
  const { data: subscription, error: subscriptionError } = await supabaseAdmin
    .from("student_subscriptions")
    .select("plan_id")
    .eq("id", subscriptionId)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;
  if (!subscription?.plan_id) return null;

  const { data: plan, error: planError } = await supabaseAdmin
    .from("subscription_plans")
    .select("interval")
    .eq("id", subscription.plan_id)
    .maybeSingle();
  if (planError) throw planError;

  return addPlanInterval(startIso, plan?.interval);
}

async function findPendingSubscription(payload: ValidapayWebhookPayload) {
  const directSubscriptionId = pickStringDeep(payload, [
    "subscription_id",
    "subscriptionId",
    "studentSubscriptionId",
  ]);
  if (directSubscriptionId) {
    const { data, error } = await supabaseAdmin
      .from("student_subscriptions")
      .select("id")
      .eq("id", directSubscriptionId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data.id;
  }

  const checkoutSessionId = pickStringDeep(payload, [
    "checkoutSessionId",
    "checkout_session_id",
    "sessionId",
    "checkoutId",
  ]);
  if (checkoutSessionId) {
    const { data, error } = await supabaseAdmin
      .from("student_subscriptions")
      .select("id")
      .eq("validapay_checkout_session_id", checkoutSessionId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data.id;
  }

  const externalLookups = [
    ["validapay_charge_id", payload.chargeId],
    ["validapay_payment_id", payload.paymentId],
    ["validapay_subscription_id", payload.subscriptionId],
  ] as const;

  for (const [column, value] of externalLookups) {
    if (!value) continue;
    const { data, error } = await supabaseAdmin
      .from("student_subscriptions")
      .select("id")
      .eq(column, value)
      .maybeSingle();
    if (error) throw error;
    if (data) return data.id;
  }

  const payerTaxId = onlyDigits(payload.payer?.taxId);
  if (!payerTaxId || !payload.amount) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("cpf", payerTaxId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return null;

  const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
    .from("student_subscriptions")
    .select("id, payment_method, status, subscription_plans(price)")
    .eq("student_id", profile.id)
    .eq("status", "pendente")
    .order("created_at", { ascending: false })
    .limit(5);
  if (subscriptionError) throw subscriptionError;

  const method = paymentMethodFromPayload(payload.paymentMethod);
  const amount = Number(payload.amount);
  const match = (subscriptions ?? []).find((subscription) => {
    const plan = subscription.subscription_plans as { price?: number } | null;
    const sameAmount = Math.abs(Number(plan?.price ?? 0) - amount) < 0.01;
    const sameMethod = !method || subscription.payment_method === method;
    return sameAmount && sameMethod;
  });

  return match?.id ?? null;
}

async function updateSubscriptionFromPayload(
  subscriptionId: string,
  payload: ValidapayWebhookPayload,
) {
  const reference = paymentReference(payload);
  const start = periodStart(payload);
  const end = await getSubscriptionPeriodEnd(subscriptionId, start);

  await activatePaidSubscription({
    _subscription_id: subscriptionId,
    _period_start: start,
    _period_end: end,
    _payment_reference: reference,
  });

  const { error } = await supabaseAdmin
    .from("student_subscriptions")
    .update({
      validapay_charge_id: payload.chargeId ?? null,
      validapay_customer_id: payload.customerId ?? null,
      validapay_payment_id: payload.paymentId ?? null,
      validapay_payment_status: normalizeProviderEvent(payload.event),
      validapay_payload: payload as Json,
      validapay_subscription_id: payload.subscriptionId ?? null,
    })
    .eq("id", subscriptionId);

  if (error) throw error;
}

async function markSubscriptionStatus(subscriptionId: string | null, status: SubscriptionStatus) {
  if (!subscriptionId) return;
  const { error } = await supabaseAdmin
    .from("student_subscriptions")
    .update({ status })
    .eq("id", subscriptionId);
  if (error) throw error;
}

function parseSignatureHeader(value: string | null) {
  if (!value) return null;
  const parts: Record<string, string> = {};
  for (const part of value.split(",")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) parts[key] = rest.join("=");
  }

  if (!parts.t || !parts.v1) return null;
  return { timestamp: parts.t, signature: parts.v1 };
}

async function verifyValidapaySignature({
  rawBody,
  secret,
  signatureHeader,
}: {
  rawBody: string;
  secret: string;
  signatureHeader: string | null;
}) {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const timestamp = Number(parsed.timestamp);
  if (!Number.isFinite(timestamp)) return false;

  const timestampMs = timestamp > 9_999_999_999 ? timestamp : timestamp * 1000;
  if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false;

  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expectedSignature = createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest("hex");

  try {
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(parsed.signature, "hex");
    if (expectedBuffer.length !== receivedBuffer.length) return false;
    return timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}

async function verifyWebhookRequest(request: Request, rawBody: string) {
  const configuredSecret = getValidapayWebhookSecret();
  if (!configuredSecret) return false;

  const isSigned = await verifyValidapaySignature({
    rawBody,
    secret: configuredSecret,
    signatureHeader: request.headers.get("x-webhook-signature"),
  });
  if (isSigned) return true;

  const requestUrl = new URL(request.url);
  const receivedToken =
    request.headers.get("x-validapay-token") ??
    request.headers.get("x-webhook-token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    requestUrl.searchParams.get("token");

  return receivedToken === configuredSecret;
}

export const Route = createFileRoute("/api/public/validapay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();

        if (!(await verifyWebhookRequest(request, rawBody))) {
          await writeSecurityEvent({
            eventType: "validapay.webhook_invalid_signature",
            severity: "high",
            route: "/api/public/validapay-webhook",
            request,
          });
          return new Response("Invalid webhook signature", { status: 401 });
        }

        let payload: ValidapayWebhookPayload;
        try {
          payload = JSON.parse(rawBody) as ValidapayWebhookPayload;
        } catch (error) {
          await writeSecurityEvent({
            eventType: "validapay.webhook_invalid_json",
            severity: "high",
            route: "/api/public/validapay-webhook",
            metadata: { message: error instanceof Error ? error.message : "invalid json" },
            request,
          });
          return new Response("Invalid JSON", { status: 400 });
        }

        const eventType = normalizeProviderEvent(payload.event);
        const providerReference = paymentReference(payload);
        const eventId = pickStringDeep(payload, ["eventId", "webhookEventId"]) ?? providerReference;

        const { data: eventRow, error: eventError } = await supabaseAdmin
          .from("validapay_webhook_events")
          .upsert(
            {
              event_id: eventId,
              event_type: eventType,
              provider_reference: providerReference,
              payload: payload as Json,
            },
            { onConflict: "event_id" },
          )
          .select("id")
          .maybeSingle();

        if (eventError) {
          await writeSecurityEvent({
            eventType: "validapay.webhook_event_log_error",
            severity: "medium",
            route: "/api/public/validapay-webhook",
            metadata: { message: eventError.message },
            request,
          });
        }

        try {
          const subscriptionId = await findPendingSubscription(payload);

          if (eventType === "payment.success" || eventType === "subscription.activated") {
            if (!subscriptionId)
              throw new Error("Assinatura pendente nao encontrada para webhook.");
            await updateSubscriptionFromPayload(subscriptionId, payload);
          }

          if (eventType === "subscription.renewed") {
            if (!subscriptionId) throw new Error("Assinatura nao encontrada para renovacao.");
            await updateSubscriptionFromPayload(subscriptionId, payload);
          }

          if (eventType === "payment.failed") {
            await markSubscriptionStatus(subscriptionId, "inadimplente");
          }

          if (eventType === "subscription.canceled") {
            await markSubscriptionStatus(subscriptionId, "cancelada");
          }

          if (eventRow?.id) {
            await supabaseAdmin
              .from("validapay_webhook_events")
              .update({ processed_at: new Date().toISOString(), processing_error: null })
              .eq("id", eventRow.id);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erro ao processar webhook.";
          if (eventRow?.id) {
            await supabaseAdmin
              .from("validapay_webhook_events")
              .update({ processing_error: message.slice(0, 500) })
              .eq("id", eventRow.id);
          }
          await writeSecurityEvent({
            eventType: "validapay.webhook_handler_error",
            severity: "high",
            route: "/api/public/validapay-webhook",
            metadata: { message },
            request,
          });
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
