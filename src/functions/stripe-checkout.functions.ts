import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function isStripePixEnabled() {
  return process.env.STRIPE_PIX_ENABLED === "true";
}

/**
 * Cria uma Checkout Session de assinatura ou pagamento Pix.
 * - Cartão: cria/usa um Stripe Price recorrente e abre subscription Checkout.
 * - Pix: abre Stripe Checkout em pagamento único. A renovação é manual por ciclo.
 *
 * Em ambos os casos, registra/atualiza student_subscriptions com status pendente.
 * O webhook confirma a ativação após pagamento.
 */
export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        planSlug: z.string().min(1).max(60),
        teacherId: z.string().uuid(),
        paymentMethod: z.enum(["card", "pix"]),
        termsAccepted: z.literal(true),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    if (data.paymentMethod === "pix" && !isStripePixEnabled()) {
      throw new Error(
        "Pagamento por PIX indisponivel no momento. Use cartao para ativar a assinatura.",
      );
    }

    // 1. Carrega plano
    const [{ data: plan, error: pErr }, { data: teacher, error: tErr }] = await Promise.all([
      supabaseAdmin
        .from("subscription_plans")
        .select("*")
        .eq("slug", data.planSlug)
        .eq("is_active", true)
        .maybeSingle(),
      supabaseAdmin
        .from("teacher_profiles")
        .select("id, is_active")
        .eq("id", data.teacherId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);
    if (pErr || !plan) throw new Error("Plano não encontrado");
    if (tErr || !teacher) throw new Error("Professor não encontrado ou inativo");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name, cpf")
      .eq("id", userId)
      .maybeSingle();

    let stripeCustomerId: string | null = null;
    const { getStripe } = await import("@/server/stripe.server");
    const stripe = getStripe();
    const { data: existingSub } = await supabaseAdmin
      .from("student_subscriptions")
      .select("stripe_customer_id")
      .eq("student_id", userId)
      .not("stripe_customer_id", "is", null)
      .limit(1)
      .maybeSingle();

    stripeCustomerId = existingSub?.stripe_customer_id ?? null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: profile?.email ?? undefined,
        name: profile?.full_name ?? undefined,
        metadata: { user_id: userId },
      });
      stripeCustomerId = customer.id;
    }

    // 3. Calcula período
    const now = new Date();
    const periodEnd = new Date(now);
    if (plan.interval === "mensal") periodEnd.setMonth(periodEnd.getMonth() + 1);
    else if (plan.interval === "trimestral") periodEnd.setMonth(periodEnd.getMonth() + 3);
    else periodEnd.setFullYear(periodEnd.getFullYear() + 1);

    // 4. Insere subscription pendente
    const { data: sub, error: sErr } = await supabaseAdmin
      .from("student_subscriptions")
      .insert({
        student_id: userId,
        teacher_id: data.teacherId,
        plan_id: plan.id,
        status: "pendente",
        payment_method: data.paymentMethod,
        stripe_customer_id: stripeCustomerId,
        terms_accepted_at: now.toISOString(),
        terms_version: "v1",
      })
      .select("id")
      .single();
    if (sErr || !sub) throw new Error("Falha ao criar assinatura: " + sErr?.message);

    const totalCents = Math.round(Number(plan.price) * 100);
    const intervalMap = { mensal: "month", trimestral: "month", anual: "year" } as const;
    const intervalCount = plan.interval === "trimestral" ? 3 : 1;

    // 5. Cria Checkout Session
    const checkoutMetadata = {
      subscription_id: sub.id,
      plan_slug: plan.slug,
      teacher_id: data.teacherId,
      user_id: userId,
      payment_method: data.paymentMethod,
      period_end: periodEnd.toISOString(),
    };

    let session;
    if (data.paymentMethod === "card") {
      session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: stripeCustomerId!,
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              unit_amount: totalCents,
              recurring: {
                interval: intervalMap[plan.interval as keyof typeof intervalMap],
                interval_count: intervalCount,
              },
              product_data: {
                name: `${plan.name} - GWLanguageFlow`,
                description: plan.description ?? undefined,
              },
            },
            quantity: 1,
          },
        ],
        metadata: checkoutMetadata,
        subscription_data: {
          metadata: checkoutMetadata,
        },
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
      });
    } else {
      session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer: stripeCustomerId!,
        payment_method_types: ["pix"],
        line_items: [
          {
            price_data: {
              currency: "brl",
              unit_amount: totalCents,
              product_data: {
                name: `${plan.name} - GWLanguageFlow`,
                description: `${plan.interval} pago por PIX manual`,
              },
            },
            quantity: 1,
          },
        ],
        metadata: checkoutMetadata,
        payment_intent_data: {
          metadata: checkoutMetadata,
        },
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
      });
    }

    await supabaseAdmin
      .from("student_subscriptions")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", sub.id);

    return { url: session.url, subscriptionId: sub.id };
  });

/**
 * Retorna a assinatura atual do aluno.
 */
export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const { data } = await supabaseAdmin
      .from("student_subscriptions")
      .select(
        "id, status, payment_method, current_period_start, current_period_end, cancel_at_period_end, last_payment_at, terms_accepted_at, terms_version, created_at, updated_at, subscription_plans(*)",
      )
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { subscription: data };
  });
