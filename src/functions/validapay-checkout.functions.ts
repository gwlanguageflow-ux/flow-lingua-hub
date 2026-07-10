import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  calculateSubscriptionPackage,
  type PackageBillingMode,
  type PackageType,
} from "@/lib/subscription-packages";

type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];
type CustomPlan = Database["public"]["Tables"]["teacher_custom_plans"]["Row"];
type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "full_name" | "age" | "cpf" | "email"
>;
type StudentProfile = Pick<
  Database["public"]["Tables"]["student_profiles"]["Row"],
  "desired_language" | "comprehension_level"
>;
type DiscountCoupon = Database["public"]["Tables"]["discount_coupons"]["Row"];
type PlanChoice =
  | {
      kind: "platform";
      id: string;
      name: string;
      description: string | null;
      slug: string;
      price: number;
      interval: Plan["interval"];
      validapay_price_id: string | null;
      validapay_product_id: string | null;
      row: Plan;
    }
  | {
      kind: "custom";
      id: string;
      name: string;
      description: string | null;
      slug: string;
      price: number;
      interval: CustomPlan["interval"];
      validapay_price_id: string | null;
      validapay_product_id: string | null;
      row: CustomPlan;
    };

const cancelMySubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  reason: z.string().trim().max(500).optional().nullable(),
});

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
  if (/^[A-Z]{3}[0-9]{2}$/.test(compact)) {
    variants.add(compact);
    variants.add(`${compact.slice(0, 3)}-${compact.slice(3)}`);
  }
  if (/^[A-Z]{4}[0-9]{2}$/.test(compact)) {
    variants.add(compact);
    variants.add(`${compact.slice(0, 4)}-${compact.slice(4)}`);
  }
  return Array.from(variants);
}

function checkoutSlug(choice: PlanChoice, coupon?: DiscountCoupon | null) {
  const base =
    choice.kind === "platform"
      ? choice.slug
      : `professor-${choice.row.teacher_id.slice(0, 8)}-${choice.id.slice(0, 8)}`;
  return coupon ? `${base}-${coupon.code.toLowerCase()}` : base;
}

async function ensureBasePriceId(choice: PlanChoice) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { createValidapayProduct } = await import("@/server/validapay.server");

  if (choice.validapay_price_id) return choice.validapay_price_id;

  const product = await createValidapayProduct({
    name: choice.name,
    description: choice.description,
    slug: checkoutSlug(choice),
    amount: Number(choice.price),
    interval: choice.interval,
  });

  const priceId = getValidapayPriceId(product);
  if (!priceId) throw new Error("ValidaPay nao retornou o priceId do plano.");

  if (choice.kind === "platform") {
    const { error } = await supabaseAdmin
      .from("subscription_plans")
      .update({
        validapay_product_id: product.productId,
        validapay_price_id: priceId,
      })
      .eq("id", choice.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin
      .from("teacher_custom_plans")
      .update({
        validapay_product_id: product.productId,
        validapay_price_id: priceId,
      })
      .eq("id", choice.id);
    if (error) throw new Error(error.message);
  }

  return priceId;
}

async function ensureDiscountedPriceId({
  choice,
  coupon,
  finalAmount,
}: {
  choice: PlanChoice;
  coupon: DiscountCoupon;
  finalAmount: number;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { createValidapayProduct } = await import("@/server/validapay.server");

  if (choice.kind === "platform") {
    const { data: discountedPrice, error } = await supabaseAdmin
      .from("discounted_plan_prices")
      .select("*")
      .eq("plan_id", choice.id)
      .eq("discount_percent", coupon.discount_percent)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (discountedPrice?.validapay_price_id) return discountedPrice.validapay_price_id;

    const product = await createValidapayProduct({
      name: `${choice.name} cupom ${coupon.code}`,
      description: `${choice.description ?? choice.name} Desconto aplicado: ${coupon.discount_percent}%.`,
      slug: checkoutSlug(choice, coupon),
      amount: finalAmount,
      interval: choice.interval,
    });

    const priceId = getValidapayPriceId(product);
    if (!priceId) throw new Error("ValidaPay nao retornou o priceId do plano com cupom.");

    const { error: upsertError } = await supabaseAdmin.from("discounted_plan_prices").upsert(
      {
        plan_id: choice.id,
        discount_percent: coupon.discount_percent,
        final_amount: finalAmount,
        validapay_product_id: product.productId,
        validapay_price_id: priceId,
      },
      { onConflict: "plan_id,discount_percent" },
    );
    if (upsertError) throw new Error(upsertError.message);
    return priceId;
  }

  const { data: discountedPrice, error } = await supabaseAdmin
    .from("discounted_teacher_plan_prices")
    .select("*")
    .eq("custom_plan_id", choice.id)
    .eq("discount_percent", coupon.discount_percent)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (discountedPrice?.validapay_price_id) return discountedPrice.validapay_price_id;

  const product = await createValidapayProduct({
    name: `${choice.name} cupom ${coupon.code}`,
    description: `${choice.description ?? choice.name} Desconto aplicado: ${coupon.discount_percent}%.`,
    slug: checkoutSlug(choice, coupon),
    amount: finalAmount,
    interval: choice.interval,
  });

  const priceId = getValidapayPriceId(product);
  if (!priceId) throw new Error("ValidaPay nao retornou o priceId do plano com cupom.");

  const { error: upsertError } = await supabaseAdmin.from("discounted_teacher_plan_prices").upsert(
    {
      custom_plan_id: choice.id,
      discount_percent: coupon.discount_percent,
      final_amount: finalAmount,
      validapay_product_id: product.productId,
      validapay_price_id: priceId,
    },
    { onConflict: "custom_plan_id,discount_percent" },
  );
  if (upsertError) throw new Error(upsertError.message);
  return priceId;
}

async function ensurePackagePriceId({
  choice,
  packageType,
  packageBillingMode,
  coupon,
  finalAmount,
}: {
  choice: PlanChoice;
  packageType: Exclude<PackageType, "mensal">;
  packageBillingMode: PackageBillingMode;
  coupon: DiscountCoupon | null;
  finalAmount: number;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { createValidapayProduct } = await import("@/server/validapay.server");
  const discountPercent = Number(coupon?.discount_percent ?? 0);

  let query = supabaseAdmin
    .from("subscription_package_prices")
    .select("*")
    .eq("package_type", packageType)
    .eq("package_billing_mode", packageBillingMode)
    .eq("coupon_discount_percent", discountPercent);
  query =
    choice.kind === "platform"
      ? query.eq("plan_id", choice.id).is("custom_plan_id", null)
      : query.eq("custom_plan_id", choice.id).is("plan_id", null);

  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing?.validapay_price_id && Math.abs(Number(existing.amount) - finalAmount) < 0.01) {
    return existing.validapay_price_id;
  }

  const packagePricing = calculateSubscriptionPackage(
    Number(choice.price),
    packageType,
    packageBillingMode,
  );
  const packageLabel = packageType === "semestral" ? "semestral" : "anual";
  const billingLabel = packageBillingMode === "upfront" ? "à vista" : "parcela mensal";
  const product = await createValidapayProduct({
    name: `${choice.name} ${packageLabel} ${billingLabel}${coupon ? ` cupom ${coupon.code}` : ""}`,
    description:
      packageBillingMode === "upfront"
        ? `${choice.description ?? choice.name} Pacote ${packageLabel} pago à vista.`
        : `${choice.description ?? choice.name} Pacote ${packageLabel} com compromisso de ${packagePricing.months} meses e cobrança mensal.`,
    slug: `${checkoutSlug(choice, coupon)}-${packageType}-${packageBillingMode}`,
    amount: finalAmount,
    interval: packageBillingMode === "upfront" && packageType === "anual" ? "anual" : "mensal",
    packageMonths: packageBillingMode === "upfront" ? (packagePricing.months as 6 | 12) : undefined,
  });

  const priceId = getValidapayPriceId(product);
  if (!priceId) throw new Error("ValidaPay nao retornou o priceId do pacote.");

  const values = {
    plan_id: choice.kind === "platform" ? choice.id : null,
    custom_plan_id: choice.kind === "custom" ? choice.id : null,
    package_type: packageType,
    package_billing_mode: packageBillingMode,
    coupon_discount_percent: discountPercent,
    amount: finalAmount,
    validapay_product_id: product.productId,
    validapay_price_id: priceId,
  };

  const { error: saveError } = existing
    ? await supabaseAdmin.from("subscription_package_prices").update(values).eq("id", existing.id)
    : await supabaseAdmin.from("subscription_package_prices").insert(values);
  if (saveError) throw new Error(saveError.message);

  return priceId;
}

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        planSlug: z.string().min(1).max(60).optional().nullable(),
        customPlanId: z.string().uuid().optional().nullable(),
        teacherId: z.string().uuid(),
        packageType: z.enum(["mensal", "semestral", "anual"]).default("mensal"),
        packageBillingMode: z.enum(["monthly", "upfront"]).default("monthly"),
        termsAccepted: z.literal(true),
        couponCode: z.string().trim().max(20).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { createValidapayCheckoutSession } = await import("@/server/validapay.server");
    const { userId } = context;

    const [
      { data: teacherProfile, error: teacherProfileError },
      { data: student, error: studentError },
      { data: studentProfile, error: studentProfileError },
    ] = await Promise.all([
      supabaseAdmin
        .from("teacher_profiles")
        .select("id, is_active, use_custom_pricing")
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

    if (teacherProfileError || !teacherProfile)
      throw new Error("Professor nao encontrado ou inativo.");
    if (studentError || !student)
      throw new Error("Complete seu cadastro de aluno antes de solicitar a assinatura.");
    if (studentProfileError || !studentProfile)
      throw new Error("Complete seu perfil de aluno antes de solicitar a assinatura.");

    let choice: PlanChoice;
    if (teacherProfile.use_custom_pricing) {
      if (!data.customPlanId) {
        throw new Error("Escolha um plano criado pelo professor antes de pagar.");
      }
      const { data: customPlan, error } = await supabaseAdmin
        .from("teacher_custom_plans")
        .select("*")
        .eq("id", data.customPlanId)
        .eq("teacher_id", data.teacherId)
        .eq("is_active", true)
        .maybeSingle();
      if (error || !customPlan) {
        throw new Error(error?.message ?? "Plano do professor nao encontrado.");
      }
      choice = {
        kind: "custom",
        id: customPlan.id,
        name: customPlan.name,
        description: customPlan.description,
        slug: `custom-${customPlan.id}`,
        price: Number(customPlan.price),
        interval: customPlan.interval,
        validapay_price_id: customPlan.validapay_price_id,
        validapay_product_id: customPlan.validapay_product_id,
        row: customPlan,
      };
    } else {
      if (!data.planSlug) {
        throw new Error("Escolha um plano da plataforma antes de pagar.");
      }
      const { data: plan, error } = await supabaseAdmin
        .from("subscription_plans")
        .select("*")
        .eq("slug", data.planSlug)
        .eq("is_active", true)
        .maybeSingle();
      if (error || !plan) throw new Error(error?.message ?? "Plano nao encontrado.");
      choice = {
        kind: "platform",
        id: plan.id,
        name: plan.name,
        description: plan.description,
        slug: plan.slug,
        price: Number(plan.price),
        interval: plan.interval,
        validapay_price_id: plan.validapay_price_id,
        validapay_product_id: plan.validapay_product_id,
        row: plan,
      };
    }

    const now = new Date().toISOString();
    const requestedCouponCode = normalizeCouponCode(data.couponCode);
    let coupon: DiscountCoupon | null = null;
    const packageBillingMode: PackageBillingMode =
      data.packageType === "mensal" ? "monthly" : data.packageBillingMode;
    const packagePricing = calculateSubscriptionPackage(
      Number(choice.price),
      data.packageType,
      packageBillingMode,
    );
    const originalAmount = packagePricing.totalAmount;
    let finalAmount = packagePricing.totalAmount;
    let discountAmount = 0;

    if (requestedCouponCode) {
      const { data: couponRow, error: couponError } = await supabaseAdmin
        .from("discount_coupons")
        .select("*")
        .in("code", couponCodeVariants(requestedCouponCode))
        .eq("active", true)
        .is("deleted_at", null)
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

    let pendingQuery = supabaseAdmin
      .from("student_subscriptions")
      .select("id")
      .eq("student_id", userId)
      .eq("teacher_id", data.teacherId)
      .eq("status", "pendente")
      .eq("package_type", data.packageType)
      .eq("package_billing_mode", packageBillingMode)
      .order("created_at", { ascending: false })
      .limit(1);

    pendingQuery =
      choice.kind === "platform"
        ? pendingQuery.eq("plan_id", choice.id).is("custom_plan_id", null)
        : pendingQuery.eq("custom_plan_id", choice.id).is("plan_id", null);

    const { data: existingPending, error: existingError } = await pendingQuery.maybeSingle();
    if (existingError) throw new Error(existingError.message);

    let subscriptionId = existingPending?.id;
    const priceId =
      data.packageType === "mensal"
        ? coupon
          ? await ensureDiscountedPriceId({ choice, coupon, finalAmount })
          : await ensureBasePriceId(choice)
        : await ensurePackagePriceId({
            choice,
            packageType: data.packageType,
            packageBillingMode,
            coupon,
            finalAmount,
          });

    if (!subscriptionId) {
      const { data: created, error: createError } = await supabaseAdmin
        .from("student_subscriptions")
        .insert({
          student_id: userId,
          teacher_id: data.teacherId,
          plan_id: choice.kind === "platform" ? choice.id : null,
          custom_plan_id: choice.kind === "custom" ? choice.id : null,
          status: "pendente",
          payment_method: null,
          package_type: data.packageType,
          package_billing_mode: packageBillingMode,
          package_months: packagePricing.paidMonths,
          package_commitment_months: packagePricing.months,
          package_monthly_amount: packagePricing.monthlyAmount,
          package_upfront_amount: packagePricing.upfrontAmount,
          package_discount_rate: packagePricing.discountRate,
          package_base_amount: packagePricing.baseAmount,
          package_total_amount: finalAmount,
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

    const { error: packageUpdateError } = await supabaseAdmin
      .from("student_subscriptions")
      .update({
        package_type: data.packageType,
        package_billing_mode: packageBillingMode,
        package_months: packagePricing.paidMonths,
        package_commitment_months: packagePricing.months,
        package_monthly_amount: packagePricing.monthlyAmount,
        package_upfront_amount: packagePricing.upfrontAmount,
        package_discount_rate: packagePricing.discountRate,
        package_base_amount: packagePricing.baseAmount,
        package_total_amount: finalAmount,
      })
      .eq("id", subscriptionId);
    if (packageUpdateError) throw new Error(packageUpdateError.message);

    if (coupon) {
      const redemptionPayload = {
        coupon_id: coupon.id,
        student_id: userId,
        teacher_id: data.teacherId,
        subscription_id: subscriptionId,
        plan_id: choice.kind === "platform" ? choice.id : null,
        custom_plan_id: choice.kind === "custom" ? choice.id : null,
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
      plan_kind: choice.kind,
      plan_id: choice.kind === "platform" ? choice.id : null,
      custom_plan_id: choice.kind === "custom" ? choice.id : null,
      plan_slug: choice.kind === "platform" ? choice.slug : null,
      teacher_id: data.teacherId,
      pricing: {
        monthly_amount: Number(choice.price),
        package_type: data.packageType,
        package_billing_mode: packageBillingMode,
        package_months: packagePricing.months,
        paid_months: packagePricing.paidMonths,
        package_monthly_amount: packagePricing.monthlyAmount,
        package_upfront_amount: packagePricing.upfrontAmount,
        package_base_amount: packagePricing.baseAmount,
        package_discount_rate: packagePricing.discountRate,
        package_discount_amount: packagePricing.discountAmount,
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
      planKind: choice.kind,
      packageType: data.packageType,
      packageBillingMode,
      packagePricing: {
        months: packagePricing.months,
        paidMonths: packagePricing.paidMonths,
        monthlyAmount: packagePricing.monthlyAmount,
        upfrontAmount: packagePricing.upfrontAmount,
        baseAmount: packagePricing.baseAmount,
        packageDiscountAmount: packagePricing.discountAmount,
        amountBeforeCoupon: originalAmount,
        finalAmount,
      },
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
        "id, status, payment_method, current_period_start, current_period_end, cancel_at_period_end, cancel_requested_at, package_type, package_billing_mode, package_months, package_commitment_months, package_commitment_end, package_monthly_amount, package_upfront_amount, package_discount_rate, package_base_amount, package_total_amount, last_payment_at, terms_accepted_at, terms_version, created_at, updated_at, plan_id, custom_plan_id, subscription_plans(*), teacher_custom_plans(*)",
      )
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { subscription: data };
  });

export const cancelMySubscriptionAtPeriodEnd = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => cancelMySubscriptionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subscription, error: lookupError } = await supabaseAdmin
      .from("student_subscriptions")
      .select("id, student_id, status, current_period_end")
      .eq("id", data.subscriptionId)
      .eq("student_id", context.userId)
      .maybeSingle();

    if (lookupError || !subscription) {
      throw new Error(lookupError?.message ?? "Assinatura nao encontrada.");
    }

    if (subscription.status === "cancelada" || subscription.status === "expirada") {
      return { ok: true, alreadyCancelled: true, accessUntil: subscription.current_period_end };
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("student_subscriptions")
      .update({
        cancel_at_period_end: true,
        cancel_requested_at: now,
        cancel_requested_by: context.userId,
        cancel_reason: data.reason || "Cancelamento solicitado pelo aluno",
        updated_at: now,
      })
      .eq("id", data.subscriptionId);

    if (updateError) throw new Error(updateError.message);

    return { ok: true, accessUntil: subscription.current_period_end };
  });
