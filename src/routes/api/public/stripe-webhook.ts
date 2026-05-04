import { createFileRoute } from "@tanstack/react-router";
import { getStripe } from "@/server/stripe.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sig = request.headers.get("stripe-signature");
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!sig || !secret) {
          return new Response("Missing signature/secret", { status: 400 });
        }

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
            case "checkout.session.completed": {
              const session = event.data.object as any;
              const bookingId = session.metadata?.booking_id;
              if (bookingId) {
                await supabaseAdmin
                  .from("bookings")
                  .update({
                    status: "confirmado",
                    payment_intent_id: session.payment_intent ?? null,
                  })
                  .eq("id", bookingId);
              }
              break;
            }
            case "checkout.session.expired":
            case "checkout.session.async_payment_failed": {
              const session = event.data.object as any;
              const bookingId = session.metadata?.booking_id;
              if (bookingId) {
                await supabaseAdmin
                  .from("bookings")
                  .update({ status: "cancelado" })
                  .eq("id", bookingId);
              }
              break;
            }
            case "account.updated": {
              const account = event.data.object as any;
              const teacherId = account.metadata?.teacher_id;
              if (teacherId) {
                await supabaseAdmin
                  .from("teacher_profiles")
                  .update({
                    stripe_onboarding_complete: !!account.details_submitted,
                    stripe_charges_enabled: !!account.charges_enabled,
                  })
                  .eq("id", teacherId);
              }
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
