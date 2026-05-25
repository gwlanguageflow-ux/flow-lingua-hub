import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  createValidapayCheckoutSession,
  createValidapayProduct,
  requireValidapayConfig,
} from "@/server/validapay.server";

type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];
type PaymentMethod = Database["public"]["Enums"]["payment_method"];

type ValidapayProfile = {
  email?: string | null;
  full_name?: string | null;
  cpf?: string | null;
};

function cleanDocument(value: string | null | undefined) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 11 || digits.length === 14 ? digits : undefined;
}

async function ensureValidapayPriceId(plan: Plan) {
  if (plan.validapay_price_id) {
    return {
      productId: plan.validapay_product_id,
      priceId: plan.validapay_price_id,
    };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const product = await createValidapayProduct({
    name: plan.name,
    description: plan.description,
    slug: plan.slug,
    amount: Number(plan.price),
    interval: plan.interval,
  });

  const priceId = product.prices?.find((price) => price.priceId)?.priceId;
  if (!priceId) throw new Error("ValidaPay nao retornou priceId para o plano.");

  await supabaseAdmin
    .from("subscription_plans")
    .update({
      validapay_product_id: product.productId,
      validapay_price_id: priceId,
    })
    .eq("id", plan.id);

  return {
    productId: product.productId,
    priceId,
  };
}

function getPeriodEnd(interval: Plan["interval"]) {
  const now = new Date();
  const periodEnd = new Date(now);
  if (interval === "mensal") periodEnd.setMonth(periodEnd.getMonth() + 1);
  else if (interval === "trimestral") periodEnd.setMonth(periodEnd.getMonth() + 3);
  else periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  return { now, periodEnd };
}

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        planSlug: z.string().min(1).max(60),
        teacherId: z.string().uuid(),
        paymentMethod: z.enum(["card", "pix"]),
        termsAccepted: z.literal(true),
        successUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    requireValidapayConfig();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const [{ data: plan, error: planError }, { data: teacher, error: teacherError }] =
      await Promise.all([
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

    if (planError || !plan) throw new Error("Plano nao encontrado.");
    if (teacherError || !teacher) throw new Error("Professor nao encontrado ou inativo.");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name, cpf")
      .eq("id", userId)
      .maybeSingle<ValidapayProfile>();

    const { now, periodEnd } = getPeriodEnd(plan.interval);
    const { priceId } = await ensureValidapayPriceId(plan);

    const { data: sub, error: subError } = await supabaseAdmin
      .from("student_subscriptions")
      .insert({
        student_id: userId,
        teacher_id: data.teacherId,
        plan_id: plan.id,
        status: "pendente",
        payment_method: data.paymentMethod as PaymentMethod,
        terms_accepted_at: now.toISOString(),
        terms_version: "v1",
      })
      .select("id")
      .single();

    if (subError || !sub) {
      throw new Error(subError?.message ?? "Falha ao criar assinatura.");
    }

    const session = await createValidapayCheckoutSession({
      priceId,
      paymentMethod: data.paymentMethod,
      customer: {
        email: profile?.email,
        documentNumber: cleanDocument(profile?.cpf),
      },
    });

    const { error: updateError } = await supabaseAdmin
      .from("student_subscriptions")
      .update({
        validapay_checkout_session_id: session.id,
        validapay_payload: {
          checkout_session: session,
          expected_period_end: periodEnd.toISOString(),
        } as Json,
      })
      .eq("id", sub.id);

    if (updateError) throw new Error(updateError.message);

    return { url: session.url, subscriptionId: sub.id };
  });

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
