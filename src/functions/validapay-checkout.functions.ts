import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];
type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "full_name" | "age" | "cpf" | "email"
>;
type StudentProfile = Pick<
  Database["public"]["Tables"]["student_profiles"]["Row"],
  "desired_language" | "comprehension_level"
>;

function getValidapayPriceId(response: { prices?: Array<{ priceId?: string }> }) {
  return response.prices?.find((price) => price.priceId)?.priceId ?? null;
}

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        planSlug: z.string().min(1).max(60),
        teacherId: z.string().uuid(),
        termsAccepted: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createValidapayCheckoutSession, createValidapayProduct } =
      await import("@/server/validapay.server");
    const { userId } = context;

    const [
      { data: plan, error: planError },
      { data: teacherProfile, error: teacherProfileError },
      { data: student, error: studentError },
      { data: studentProfile, error: studentProfileError },
    ] = await Promise.all([
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
      supabaseAdmin
        .from("profiles")
        .select("full_name, age, cpf, email")
        .eq("id", userId)
        .maybeSingle<Profile>(),
      supabaseAdmin
        .from("student_profiles")
        .select("desired_language, comprehension_level")
        .eq("id", userId)
        .maybeSingle<StudentProfile>(),
    ]);

    if (planError || !plan) throw new Error("Plano nao encontrado.");
    if (teacherProfileError || !teacherProfile)
      throw new Error("Professor nao encontrado ou inativo.");
    if (studentError || !student)
      throw new Error("Complete seu cadastro de aluno antes de solicitar a assinatura.");
    if (studentProfileError || !studentProfile)
      throw new Error("Complete seu perfil de aluno antes de solicitar a assinatura.");

    const now = new Date().toISOString();
    const { data: existingPending, error: existingError } = await supabaseAdmin
      .from("student_subscriptions")
      .select("id")
      .eq("student_id", userId)
      .eq("teacher_id", data.teacherId)
      .eq("plan_id", plan.id)
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    let subscriptionId = existingPending?.id;
    let priceId = plan.validapay_price_id;

    if (!priceId) {
      const product = await createValidapayProduct({
        name: plan.name,
        description: plan.description,
        slug: plan.slug,
        amount: Number(plan.price),
        interval: plan.interval,
      });

      priceId = getValidapayPriceId(product);
      if (!priceId) throw new Error("ValidaPay nao retornou o priceId do plano.");

      const { error: planUpdateError } = await supabaseAdmin
        .from("subscription_plans")
        .update({
          validapay_product_id: product.productId,
          validapay_price_id: priceId,
        })
        .eq("id", plan.id);

      if (planUpdateError) throw new Error(planUpdateError.message);
    }

    if (!subscriptionId) {
      const { data: created, error: createError } = await supabaseAdmin
        .from("student_subscriptions")
        .insert({
          student_id: userId,
          teacher_id: data.teacherId,
          plan_id: plan.id,
          status: "pendente",
          payment_method: null,
          terms_accepted_at: now,
          terms_version: "v1",
        })
        .select("id")
        .single();

      if (createError || !created) {
        throw new Error(createError?.message ?? "Falha ao registrar solicitacao de assinatura.");
      }

      subscriptionId = created.id;
    }

    if (!subscriptionId) throw new Error("Falha ao registrar solicitacao de assinatura.");

    const session = await createValidapayCheckoutSession({
      priceId,
      customer: {
        name: student.full_name,
        email: student.email,
        documentNumber: student.cpf,
      },
    });

    const payload = {
      provider: "validapay",
      channel: "checkout_session",
      requested_at: now,
      checkout_session: session,
      plan_slug: plan.slug,
      teacher_id: data.teacherId,
      student_profile: {
        desired_language: studentProfile.desired_language,
        comprehension_level: studentProfile.comprehension_level,
      },
      allowed_payment_methods: ["creditcard", "pix"],
    } as Json;

    const { error: updateError } = await supabaseAdmin
      .from("student_subscriptions")
      .update({
        terms_accepted_at: now,
        terms_version: "v1",
        validapay_checkout_session_id: session.id,
        validapay_payload: payload,
        validapay_payment_status: "checkout.created",
      })
      .eq("id", subscriptionId);

    if (updateError) throw new Error(updateError.message);

    return {
      url: session.url,
      subscriptionId,
      channel: "validapay",
      status: "pendente",
    };
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
