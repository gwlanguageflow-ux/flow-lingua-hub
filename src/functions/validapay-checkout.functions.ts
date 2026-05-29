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
type DiscountCoupon = Database["public"]["Tables"]["discount_coupons"]["Row"];

function getValidapayPriceId(response: { prices?: Array<{ priceId?: string }> }) {
  return response.prices?.find((price) => price.priceId)?.priceId ?? null;
}

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function normalizeCouponCode(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "");
}

function couponCodeVariants(code: string) {
  const variants = new Set([code]);
  const compact = code.replace(/-/g, "");
  if (/^[A-Z]{4}[0-9]{2}$/.test(compact)) {
    variants.add(compact);
    variants.add(`${compact.slice(0, 4)}-${compact.slice(4)}`);
  }
  return Array.from(variants);
}

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        planSlug: z.string().min(1).max(60),
        teacherId: z.string().uuid(),
        termsAccepted: z.literal(true),
        couponCode: z.string().trim().max(20).optional().nullable(),
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
    const requestedCouponCode = normalizeCouponCode(data.couponCode);
    let coupon: DiscountCoupon | null = null;
    const originalAmount = toMoney(Number(plan.price));
    let finalAmount = originalAmount;
    let discountAmount = 0;

    if (requestedCouponCode) {
      const { data: couponRow, error: couponError } = await supabaseAdmin
        .from("discount_coupons")
        .select("*")
        .in("code", couponCodeVariants(requestedCouponCode))
        .eq("active", true)
        .lte("starts_at", now)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<DiscountCoupon>();

      if (couponError) throw new Error(couponError.message);
      if (!couponRow) throw new Error("Cupom nao encontrado ou expirado.");
      if (couponRow.scope === "teacher" && couponRow.teacher_id !== data.teacherId) {
        throw new Error("Este cupom pertence a outro professor.");
      }

      coupon = couponRow;
      discountAmount = toMoney((originalAmount * coupon.discount_percent) / 100);
      finalAmount = toMoney(originalAmount - discountAmount);
    }

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

    if (coupon) {
      const { data: discountedPrice, error: discountedPriceError } = await supabaseAdmin
        .from("discounted_plan_prices")
        .select("*")
        .eq("plan_id", plan.id)
        .eq("discount_percent", coupon.discount_percent)
        .maybeSingle();
      if (discountedPriceError) throw new Error(discountedPriceError.message);

      priceId = discountedPrice?.validapay_price_id ?? null;
      if (!priceId) {
        const product = await createValidapayProduct({
          name: `${plan.name} cupom ${coupon.code}`,
          description: `${plan.description ?? plan.name} Desconto aplicado: ${coupon.discount_percent}%.`,
          slug: `${plan.slug}-${coupon.code.toLowerCase()}`,
          amount: finalAmount,
          interval: plan.interval,
        });

        priceId = getValidapayPriceId(product);
        if (!priceId) throw new Error("ValidaPay nao retornou o priceId do plano com cupom.");

        const { error: discountedUpdateError } = await supabaseAdmin
          .from("discounted_plan_prices")
          .upsert(
            {
              plan_id: plan.id,
              discount_percent: coupon.discount_percent,
              final_amount: finalAmount,
              validapay_product_id: product.productId,
              validapay_price_id: priceId,
            },
            { onConflict: "plan_id,discount_percent" },
          );
        if (discountedUpdateError) throw new Error(discountedUpdateError.message);
      }
    } else if (!priceId) {
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

    if (coupon) {
      const redemptionPayload = {
        coupon_id: coupon.id,
        student_id: userId,
        teacher_id: data.teacherId,
        subscription_id: subscriptionId,
        plan_id: plan.id,
        original_amount: originalAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        status: "checkout_created" as const,
      };
      const { data: existingRedemption, error: existingRedemptionError } = await supabaseAdmin
        .from("coupon_redemptions")
        .select("id")
        .eq("subscription_id", subscriptionId)
        .eq("status", "checkout_created")
        .maybeSingle();
      if (existingRedemptionError) throw new Error(existingRedemptionError.message);

      const { error: redemptionError } = existingRedemption
        ? await supabaseAdmin
            .from("coupon_redemptions")
            .update(redemptionPayload)
            .eq("id", existingRedemption.id)
        : await supabaseAdmin.from("coupon_redemptions").insert(redemptionPayload);
      if (redemptionError) throw new Error(redemptionError.message);
    } else {
      await supabaseAdmin
        .from("coupon_redemptions")
        .update({ status: "cancelled" })
        .eq("subscription_id", subscriptionId)
        .eq("status", "checkout_created");
    }

    const session = await createValidapayCheckoutSession({
      priceId,
      allowedPaymentMethods: ["creditcard", "pix"],
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
      pricing: {
        original_amount: originalAmount,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        coupon_code: coupon?.code ?? null,
        coupon_id: coupon?.id ?? null,
        discount_percent: coupon?.discount_percent ?? null,
      },
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
      coupon: coupon
        ? {
            code: coupon.code,
            discountPercent: coupon.discount_percent,
            discountAmount,
            finalAmount,
          }
        : null,
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
