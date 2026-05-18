import { createFileRoute } from "@tanstack/react-router";
import { getStripe } from "@/server/stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];
type CheckoutSessionPayload = {
  metadata?: Record<string, string> | null;
  mode?: string | null;
  subscription?: string | { id: string } | null;
  payment_status?: string | null;
};
type InvoicePayload = {
  subscription?: string | { id: string } | null;
  period_start?: number | null;
  period_end?: number | null;
};
type SubscriptionPayload = {
  id: string;
  status: string;
  cancel_at_period_end?: boolean | null;
  current_period_start?: number | null;
  current_period_end?: number | null;
};

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : (value?.id ?? null);
}

async function activateCheckoutSession(session: CheckoutSessionPayload) {
  const subscriptionId = session.metadata?.subscription_id;
  if (!subscriptionId) return;

  if (session.mode === "subscription") {
    const { error } = await supabaseAdmin.rpc("activate_paid_student_subscription", {
      _subscription_id: subscriptionId,
      _stripe_subscription_id: stripeId(session.subscription),
      _period_start: new Date().toISOString(),
      _period_end: null,
    });
    if (error) throw error;
    return;
  }

  if (session.mode === "payment") {
    const periodEnd = session.metadata?.period_end;
    const { error } = await supabaseAdmin.rpc("activate_paid_student_subscription", {
      _subscription_id: subscriptionId,
      _stripe_subscription_id: null,
      _period_start: new Date().toISOString(),
      _period_end: periodEnd ?? null,
    });
    if (error) throw error;
  }
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sig = request.headers.get("stripe-signature");
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!sig || !secret) return new Response("Missing signature/secret", { status: 400 });

        const body = await request.text();
        const stripe = getStripe();

        let event;
        try {
          event = stripe.webhooks.constructEvent(body, sig, secret);
        } catch (err) {
          console.error("Webhook signature verification failed:", err);
          return new Response("Invalid signature", { status: 401 });
        }

        try {
          switch (event.type) {
            // Cartao recorrente: o checkout completo ja representa o primeiro pagamento.
            // PIX e outros metodos assincronos so ativam se o pagamento estiver confirmado.
            case "checkout.session.completed": {
              const session = event.data.object as CheckoutSessionPayload;
              if (session.mode === "payment" && session.payment_status !== "paid") break;
              await activateCheckoutSession(session);
              break;
            }

            case "checkout.session.async_payment_succeeded": {
              const session = event.data.object as CheckoutSessionPayload;
              await activateCheckoutSession(session);
              break;
            }

            case "checkout.session.expired":
            case "checkout.session.async_payment_failed": {
              const session = event.data.object as CheckoutSessionPayload;
              const subscriptionId = session.metadata?.subscription_id;
              if (subscriptionId) {
                await supabaseAdmin
                  .from("student_subscriptions")
                  .update({ status: "cancelada" })
                  .eq("id", subscriptionId);
              }
              break;
            }

            // Renovação recorrente (Cartão)
            case "invoice.paid": {
              const invoice = event.data.object as InvoicePayload;
              const stripeSubId = stripeId(invoice.subscription);
              if (stripeSubId) {
                await supabaseAdmin
                  .from("student_subscriptions")
                  .update({
                    status: "ativa",
                    last_payment_at: new Date().toISOString(),
                    current_period_start: invoice.period_start
                      ? new Date(invoice.period_start * 1000).toISOString()
                      : null,
                    current_period_end: invoice.period_end
                      ? new Date(invoice.period_end * 1000).toISOString()
                      : null,
                  })
                  .eq("stripe_subscription_id", stripeSubId);
              }
              break;
            }

            case "invoice.payment_failed": {
              const invoice = event.data.object as InvoicePayload;
              const stripeSubId = stripeId(invoice.subscription);
              if (stripeSubId) {
                await supabaseAdmin
                  .from("student_subscriptions")
                  .update({ status: "inadimplente" })
                  .eq("stripe_subscription_id", stripeSubId);
              }
              break;
            }

            case "customer.subscription.updated": {
              const s = event.data.object as SubscriptionPayload;
              const statusMap: Record<string, SubscriptionStatus> = {
                active: "ativa",
                trialing: "ativa",
                past_due: "inadimplente",
                unpaid: "inadimplente",
                canceled: "cancelada",
                incomplete: "pendente",
                incomplete_expired: "cancelada",
              };
              await supabaseAdmin
                .from("student_subscriptions")
                .update({
                  status: statusMap[s.status] ?? "pendente",
                  cancel_at_period_end: !!s.cancel_at_period_end,
                  current_period_start: s.current_period_start
                    ? new Date(s.current_period_start * 1000).toISOString()
                    : null,
                  current_period_end: s.current_period_end
                    ? new Date(s.current_period_end * 1000).toISOString()
                    : null,
                })
                .eq("stripe_subscription_id", s.id);
              break;
            }

            case "customer.subscription.deleted": {
              const s = event.data.object as SubscriptionPayload;
              await supabaseAdmin
                .from("student_subscriptions")
                .update({ status: "cancelada" })
                .eq("stripe_subscription_id", s.id);
              break;
            }
          }
        } catch (err) {
          console.error("Webhook handler error:", err);
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
