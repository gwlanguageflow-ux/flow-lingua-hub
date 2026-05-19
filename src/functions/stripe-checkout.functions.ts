import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createAsaasCustomer,
  createAsaasPixAutomaticAuthorization,
  requireAsaasConfig,
} from "@/server/asaas.server";

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function asaasFrequency(interval: string) {
  if (interval === "trimestral") return "QUARTERLY" as const;
  if (interval === "anual") return "ANNUALLY" as const;
  return "MONTHLY" as const;
}

function contractIdFromSubscription(subscriptionId: string) {
  return subscriptionId.replace(/-/g, "").slice(0, 35);
}

/**
 * Cria uma Checkout Session de assinatura ou autorização Pix.
 * - Cartão: cria/usa um Stripe Price recorrente e abre subscription Checkout.
 * - Pix: cria uma autorização de Pix Automático pelo Asaas.
 *
 * Em ambos os casos, registra/atualiza student_subscriptions com status pendente.
 * O webhook confirma a ativação após pagamento/autorização.
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
    if (data.paymentMethod === "card") {
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
    let session;
    if (data.paymentMethod === "card") {
      const { getStripe } = await import("@/server/stripe.server");
      const stripe = getStripe();
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
        metadata: {
          subscription_id: sub.id,
          plan_slug: plan.slug,
          teacher_id: data.teacherId,
          user_id: userId,
        },
        subscription_data: {
          metadata: {
            subscription_id: sub.id,
            plan_slug: plan.slug,
            teacher_id: data.teacherId,
            user_id: userId,
          },
        },
        success_url: data.successUrl,
        cancel_url: data.cancelUrl,
      });
    } else {
      requireAsaasConfig();
      const cpfCnpj = profile?.cpf?.replace(/\D/g, "") ?? "";
      if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
        throw new Error("CPF do aluno é obrigatório para ativar Pix Automático.");
      }

      const asaasCustomer = await createAsaasCustomer({
        name: profile?.full_name ?? "Aluno GWLanguageFlow",
        email: profile?.email ?? null,
        cpfCnpj,
        externalReference: `student:${userId}`,
      });
      const contractId = contractIdFromSubscription(sub.id);
      const authorization = await createAsaasPixAutomaticAuthorization({
        customerId: asaasCustomer.id,
        contractId,
        frequency: asaasFrequency(plan.interval),
        startDate: formatDateOnly(now),
        value: Number(plan.price),
        description: `GWLanguageFlow ${plan.interval}`,
      });
      const immediateQrCode = authorization.immediateQrCode ?? null;

      await supabaseAdmin
        .from("student_subscriptions")
        .update({
          asaas_customer_id: asaasCustomer.id,
          asaas_pix_authorization_id: authorization.id,
          asaas_pix_authorization_status: authorization.status ?? null,
          asaas_pix_contract_id: contractId,
          asaas_pix_payload: immediateQrCode?.payload ?? null,
          asaas_pix_encoded_image: immediateQrCode?.encodedImage ?? null,
          asaas_pix_expiration_date: immediateQrCode?.expirationDate ?? null,
          asaas_pix_conciliation_id: immediateQrCode?.conciliationIdentifier ?? null,
        })
        .eq("id", sub.id);

      return {
        subscriptionId: sub.id,
        pix: {
          provider: "asaas",
          authorizationId: authorization.id,
          payload: immediateQrCode?.payload ?? "",
          encodedImage: immediateQrCode?.encodedImage ?? null,
          expirationDate: immediateQrCode?.expirationDate ?? null,
        },
      };
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
