import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";

type PlanInterval = Database["public"]["Enums"]["plan_interval"];

export type ActivateStudentSubscriptionInput = {
  subscriptionId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  paymentReference?: string | null;
  teacherDescription?: string;
  platformDescription?: string;
};

export type ActivateStudentSubscriptionResult = {
  teacher_transaction_id: string | null;
  platform_transaction_id: string | null;
  teacher_amount: number;
  platform_amount: number;
  gross_amount: number;
};

type StudentSubscription = Tables<"student_subscriptions">;
type StudentSubscriptionWithTeacher = StudentSubscription & { teacher_id: string };
type SubscriptionPlan = Tables<"subscription_plans">;
type TeacherCustomPlan = Tables<"teacher_custom_plans">;
type TeacherProfile = Tables<"teacher_profiles">;
type StudentProfile = Tables<"student_profiles">;
type TeacherWalletTransaction = Tables<"teacher_wallet_transactions">;
type PlatformWalletTransaction = Tables<"platform_wallet_transactions">;

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function addPlanInterval(startIso: string, interval: PlanInterval | null | undefined) {
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

function addSubscriptionPeriod(
  startIso: string,
  subscription: StudentSubscription,
  interval: PlanInterval | null | undefined,
) {
  if (subscription.package_billing_mode === "monthly") {
    const end = new Date(startIso);
    if (!Number.isFinite(end.getTime())) return null;
    end.setMonth(end.getMonth() + 1);
    return end.toISOString();
  }

  const months = Number(subscription.package_months ?? 1);
  if ([1, 6, 12].includes(months)) {
    const end = new Date(startIso);
    if (!Number.isFinite(end.getTime())) return null;
    end.setMonth(end.getMonth() + months);
    return end.toISOString();
  }
  return addPlanInterval(startIso, interval);
}

async function getSubscription(subscriptionId: string) {
  const { data, error } = await supabaseAdmin
    .from("student_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Assinatura nao encontrada.");
  if (!data.teacher_id) throw new Error("Assinatura sem professor vinculado.");

  return data as StudentSubscriptionWithTeacher;
}

async function getPlanForSubscription(subscription: StudentSubscriptionWithTeacher) {
  if (subscription.plan_id) {
    const { data, error } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("id", subscription.plan_id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Plano da assinatura nao encontrado.");
    return { price: Number(data.price), interval: data.interval } satisfies Pick<
      SubscriptionPlan,
      "price" | "interval"
    >;
  }

  if (subscription.custom_plan_id) {
    const { data, error } = await supabaseAdmin
      .from("teacher_custom_plans")
      .select("*")
      .eq("id", subscription.custom_plan_id)
      .eq("teacher_id", subscription.teacher_id)
      .eq("is_active", true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) throw new Error("Plano do professor nao encontrado ou inativo.");
    return { price: Number(data.price), interval: data.interval } satisfies Pick<
      TeacherCustomPlan,
      "price" | "interval"
    >;
  }

  throw new Error("Assinatura sem plano vinculado.");
}

async function getCouponFinalAmount(subscriptionId: string) {
  const { data, error } = await supabaseAdmin
    .from("coupon_redemptions")
    .select("final_amount")
    .eq("subscription_id", subscriptionId)
    .in("status", ["checkout_created", "paid"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const amount = Number(data?.final_amount ?? 0);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

async function getTeacher(teacherId: string) {
  const { data, error } = await supabaseAdmin
    .from("teacher_profiles")
    .select("*")
    .eq("id", teacherId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Professor nao encontrado ou inativo.");
  return data as TeacherProfile;
}

async function getStudent(studentId: string) {
  const { data, error } = await supabaseAdmin
    .from("student_profiles")
    .select("*")
    .eq("id", studentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as StudentProfile | null;
}

async function findTeacherTransaction(subscriptionId: string, paymentReference?: string | null) {
  let query = supabaseAdmin
    .from("teacher_wallet_transactions")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .eq("transaction_type", "manual_adjustment")
    .order("created_at", { ascending: true })
    .limit(1);

  if (paymentReference) query = query.eq("subscription_payment_reference", paymentReference);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data as TeacherWalletTransaction | null;
}

async function findPlatformTransaction(subscriptionId: string, paymentReference?: string | null) {
  let query = supabaseAdmin
    .from("platform_wallet_transactions")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .eq("transaction_type", "subscription_fee")
    .order("created_at", { ascending: true })
    .limit(1);

  if (paymentReference) query = query.eq("subscription_payment_reference", paymentReference);

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data as PlatformWalletTransaction | null;
}

function isSamePaidPeriod(subscription: StudentSubscription, periodStart: string) {
  if (subscription.status !== "ativa") return false;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end).getTime()
    : NaN;
  const start = new Date(periodStart).getTime();
  return Number.isFinite(periodEnd) && Number.isFinite(start) && start < periodEnd;
}

async function ensureStudentClass({
  subscription,
  teacher,
  student,
}: {
  subscription: StudentSubscriptionWithTeacher;
  teacher: TeacherProfile;
  student: StudentProfile | null;
}) {
  const teacherId = subscription.teacher_id;

  const { data: existingClass, error: classError } = await supabaseAdmin
    .from("class_groups")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("status", "ativa")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (classError) throw new Error(classError.message);

  let classId = existingClass?.id ?? null;

  if (!classId) {
    const language = teacher.languages_taught?.[0] || student?.desired_language || "Idioma";
    const { data: createdClass, error: createError } = await supabaseAdmin
      .from("class_groups")
      .insert({
        teacher_id: teacherId,
        name: "Alunos assinantes",
        language,
        level: student?.comprehension_level ?? "iniciante",
        description: "Turma padrao para alunos com assinatura ativa.",
      })
      .select("id")
      .single();

    if (createError) throw new Error(createError.message);
    classId = createdClass.id;
  }

  const { data: existingMember, error: memberError } = await supabaseAdmin
    .from("class_members")
    .select("id")
    .eq("class_id", classId)
    .eq("student_id", subscription.student_id)
    .maybeSingle();

  if (memberError) throw new Error(memberError.message);

  if (existingMember) {
    const { error } = await supabaseAdmin
      .from("class_members")
      .update({ status: "ativo", joined_at: new Date().toISOString() })
      .eq("id", existingMember.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabaseAdmin.from("class_members").insert({
    class_id: classId,
    student_id: subscription.student_id,
    status: "ativo",
  });
  if (error) throw new Error(error.message);
}

export async function activateStudentSubscriptionServer({
  subscriptionId,
  periodStart,
  periodEnd,
  paymentReference,
  teacherDescription = "Credito de assinatura paga via ValidaPay",
  platformDescription = "Taxa da plataforma sobre assinatura paga via ValidaPay",
}: ActivateStudentSubscriptionInput): Promise<ActivateStudentSubscriptionResult[]> {
  const subscription = await getSubscription(subscriptionId);
  const reference =
    paymentReference?.trim() || subscription.validapay_checkout_session_id || subscription.id;
  const start = periodStart || new Date().toISOString();
  const plan = await getPlanForSubscription(subscription);
  const couponFinalAmount = await getCouponFinalAmount(subscription.id);
  const storedPackageAmount = Number(subscription.package_total_amount ?? 0);
  const grossAmount = toMoney(
    couponFinalAmount ?? (storedPackageAmount > 0 ? storedPackageAmount : Number(plan.price)),
  );
  const teacherAmount = toMoney(grossAmount * 0.9);
  const platformAmount = toMoney(grossAmount - teacherAmount);
  const resolvedPeriodEnd = periodEnd || addSubscriptionPeriod(start, subscription, plan.interval);
  const commitmentEnd = (() => {
    const months = Number(
      subscription.package_commitment_months ?? subscription.package_months ?? 1,
    );
    if (months <= 1) return null;
    if (subscription.package_commitment_end) {
      const current = new Date(subscription.package_commitment_end);
      if (Number.isFinite(current.getTime()) && current.getTime() > Date.now()) {
        return subscription.package_commitment_end;
      }
    }
    const end = new Date(start);
    if (!Number.isFinite(end.getTime())) return null;
    end.setMonth(end.getMonth() + months);
    return end.toISOString();
  })();
  const teacher = await getTeacher(subscription.teacher_id);
  const student = await getStudent(subscription.student_id);

  const existingTeacherForReference = await findTeacherTransaction(subscription.id, reference);
  const existingPlatformForReference = await findPlatformTransaction(subscription.id, reference);

  if (
    existingTeacherForReference &&
    existingPlatformForReference &&
    isSamePaidPeriod(subscription, start)
  ) {
    await ensureStudentClass({ subscription, teacher, student });
    return [
      {
        teacher_transaction_id: existingTeacherForReference.id,
        platform_transaction_id: existingPlatformForReference.id,
        teacher_amount: Number(existingTeacherForReference.amount),
        platform_amount: Number(existingPlatformForReference.amount),
        gross_amount: Number(existingTeacherForReference.gross_amount ?? grossAmount),
      },
    ];
  }

  const existingTeacherForPeriod = await findTeacherTransaction(subscription.id);
  const existingPlatformForPeriod = await findPlatformTransaction(subscription.id);
  const samePeriodAlreadyCredited =
    isSamePaidPeriod(subscription, start) && existingTeacherForPeriod && existingPlatformForPeriod;

  const { error: subscriptionError } = await supabaseAdmin
    .from("student_subscriptions")
    .update({
      status: "ativa",
      current_period_start: start,
      current_period_end: resolvedPeriodEnd,
      package_commitment_end: commitmentEnd,
      last_payment_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscription.id);

  if (subscriptionError) throw new Error(subscriptionError.message);

  let teacherTransaction = samePeriodAlreadyCredited ? existingTeacherForPeriod : null;
  let platformTransaction = samePeriodAlreadyCredited ? existingPlatformForPeriod : null;

  if (!teacherTransaction) {
    const insert: TablesInsert<"teacher_wallet_transactions"> = {
      teacher_id: teacher.id,
      subscription_id: subscription.id,
      subscription_payment_reference: reference,
      transaction_type: "manual_adjustment",
      amount: teacherAmount,
      gross_amount: grossAmount,
      platform_fee: platformAmount,
      platform_fee_rate: 0.1,
      description: teacherDescription,
      created_by: subscription.student_id,
    };

    const { data, error } = await supabaseAdmin
      .from("teacher_wallet_transactions")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    teacherTransaction = data as TeacherWalletTransaction;
  }

  if (!platformTransaction) {
    const insert: TablesInsert<"platform_wallet_transactions"> = {
      subscription_id: subscription.id,
      subscription_payment_reference: reference,
      teacher_id: teacher.id,
      student_id: subscription.student_id,
      transaction_type: "subscription_fee",
      amount: platformAmount,
      gross_amount: grossAmount,
      fee_rate: 0.1,
      description: platformDescription,
      created_by: subscription.student_id,
    };

    const { data, error } = await supabaseAdmin
      .from("platform_wallet_transactions")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    platformTransaction = data as PlatformWalletTransaction;
  }

  await ensureStudentClass({ subscription, teacher, student });

  return [
    {
      teacher_transaction_id: teacherTransaction.id,
      platform_transaction_id: platformTransaction.id,
      teacher_amount: Number(teacherTransaction.amount),
      platform_amount: Number(platformTransaction.amount),
      gross_amount: Number(teacherTransaction.gross_amount ?? grossAmount),
    },
  ];
}
