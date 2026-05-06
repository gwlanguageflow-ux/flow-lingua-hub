import { createFileRoute } from "@tanstack/react-router";
import { getStripe } from "@/server/stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
            // Cartão: assinatura recorrente concluída no checkout
            case "checkout.session.completed": {
              const session = event.data.object as any;
              const subscriptionId = session.metadata?.subscription_id;
              if (!subscriptionId) break;

              if (session.mode === "subscription") {
                await supabaseAdmin
                  .from("student_subscriptions")
                  .update({
                    status: "ativa",
                    stripe_subscription_id: session.subscription ?? null,
                    last_payment_at: new Date().toISOString(),
                  })
                  .eq("id", subscriptionId);
              } else if (session.mode === "payment") {
                // PIX único — period_end vem nos metadados
                const periodEnd = session.metadata?.period_end;
                await supabaseAdmin
                  .from("student_subscriptions")
                  .update({
                    status: "ativa",
                    current_period_start: new Date().toISOString(),
                    current_period_end: periodEnd ?? null,
                    last_payment_at: new Date().toISOString(),
                  })
                  .eq("id", subscriptionId);
              }
              break;
            }

            case "checkout.session.expired":
            case "checkout.session.async_payment_failed": {
              const session = event.data.object as any;
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
              const invoice = event.data.object as any;
              const stripeSubId = invoice.subscription;
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
              const invoice = event.data.object as any;
              const stripeSubId = invoice.subscription;
              if (stripeSubId) {
                await supabaseAdmin
                  .from("student_subscriptions")
                  .update({ status: "inadimplente" })
                  .eq("stripe_subscription_id", stripeSubId);
              }
              break;
            }

            case "customer.subscription.updated": {
              const s = event.data.object as any;
              const statusMap: Record<string, string> = {
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
                  status: (statusMap[s.status] ?? "pendente") as any,
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
              const s = event.data.object as any;
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
