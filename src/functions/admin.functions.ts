import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { activateStudentSubscriptionServer } from "@/server/subscription-activation.server";
import type { Enums, Tables } from "@/integrations/supabase/types";

type AppRole = Enums<"app_role">;
type WithdrawalStatus = Enums<"teacher_withdrawal_status">;
type TargetType = "all" | "role" | "user" | "class";
type Profile = Tables<"profiles">;
type UserRole = Tables<"user_roles">;
type PlatformWalletTransaction = Tables<"platform_wallet_transactions">;
type TeacherWalletTransaction = Tables<"teacher_wallet_transactions">;
type TeacherWithdrawalRequest = Tables<"teacher_withdrawal_requests">;
type TeacherPayoutProfile = Tables<"teacher_payout_profiles">;
type ClassMaterial = Tables<"class_materials">;
type DiscountCoupon = Tables<"discount_coupons">;
type CouponRedemption = Tables<"coupon_redemptions">;
type SubscriptionPlanSummary = Pick<Tables<"subscription_plans">, "id" | "name" | "price" | "slug">;
type CustomPlanSummary = Pick<Tables<"teacher_custom_plans">, "id" | "name" | "price">;
type SubscriptionWithPlan = Pick<
  Tables<"student_subscriptions">,
  | "id"
  | "student_id"
  | "teacher_id"
  | "plan_id"
  | "custom_plan_id"
  | "status"
  | "created_at"
  | "current_period_end"
  | "cancel_at_period_end"
  | "cancel_requested_at"
  | "package_type"
  | "package_months"
  | "package_total_amount"
> & {
  subscription_plans: SubscriptionPlanSummary | null;
  teacher_custom_plans: CustomPlanSummary | null;
};
type PlatformRange = "30d" | "90d" | "365d";
type DirectorTarget = {
  target_type: TargetType;
  target_role: AppRole | null;
  target_user_id: string | null;
  target_class_id: string | null;
};

const targetSchema = z.object({
  targetType: z.enum(["all", "role", "user", "class"]),
  targetRole: z.enum(["dev", "professor", "aluno"]).optional().nullable(),
  targetUserId: z.string().uuid().optional().nullable(),
  targetClassId: z.string().uuid().optional().nullable(),
});

const messageSchema = targetSchema.extend({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(3000),
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
});

const alertSchema = targetSchema.extend({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(2000),
  tone: z.enum(["info", "warning", "urgent"]).default("info"),
  active: z.boolean().default(true),
  expiresAt: z.string().datetime().optional().nullable(),
});

const directMessageSchema = z.object({
  userId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

const reportSchema = z.object({
  category: z.string().trim().min(3).max(80).default("geral"),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(3000),
});

const updateReportSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(["novo", "em_analise", "resolvido", "arquivado"]),
  adminNotes: z.string().trim().max(2000).optional().nullable(),
});

const directorWithdrawalSchema = z.object({
  amount: z.coerce.number().positive(),
  accountHolderName: z.string().trim().min(2).max(160),
  pixKey: z.string().trim().min(3).max(200),
  note: z.string().trim().max(500).optional().nullable(),
});

const activateSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
});

const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  reason: z.string().trim().max(500).optional().nullable(),
});

const confirmTeacherWithdrawalSchema = z.object({
  withdrawalId: z.string().uuid(),
});

const alertStatusSchema = z.object({
  alertId: z.string().uuid(),
  active: z.boolean(),
});

const readSchema = z.object({
  messageId: z.string().uuid(),
});

const trimRole = (role: AppRole | null | undefined) => role ?? null;

function normalizeTarget(input: z.infer<typeof targetSchema>): DirectorTarget {
  if (input.targetType === "all") {
    return {
      target_type: "all",
      target_role: null,
      target_user_id: null,
      target_class_id: null,
    };
  }

  if (input.targetType === "role") {
    if (!input.targetRole) throw new Error("Selecione o perfil de destino.");
    return {
      target_type: "role",
      target_role: trimRole(input.targetRole),
      target_user_id: null,
      target_class_id: null,
    };
  }

  if (input.targetType === "user") {
    if (!input.targetUserId) throw new Error("Selecione o usuário de destino.");
    return {
      target_type: "user",
      target_role: null,
      target_user_id: input.targetUserId,
      target_class_id: null,
    };
  }

  if (!input.targetClassId) throw new Error("Selecione a turma de destino.");
  return {
    target_type: "class",
    target_role: null,
    target_user_id: null,
    target_class_id: input.targetClassId,
  };
}

async function requireDirector(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: role, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "dev")
    .maybeSingle();

  if (error || !role) {
    throw new Response("Forbidden", { status: 403 });
  }

  return supabaseAdmin;
}

function isTargetedToUser(
  item: DirectorTarget,
  userId: string,
  roles: AppRole[],
  classIds: Set<string>,
) {
  if (item.target_type === "all") return true;
  if (item.target_type === "role" && item.target_role) return roles.includes(item.target_role);
  if (item.target_type === "user") return item.target_user_id === userId;
  if (item.target_type === "class" && item.target_class_id)
    return classIds.has(item.target_class_id);
  return false;
}

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function readAmount(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function maskCpf(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return "CPF configurado";
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
}

function inferPixKeyType(value: string) {
  const trimmed = value.trim();
  const digits = onlyDigits(trimmed);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "email";
  if (digits.length === 11) return "cpf";
  if (digits.length >= 10 && digits.length <= 13) return "telefone";
  return "aleatoria";
}

function maskPixKey(value: string, type: string) {
  if (!value) return "";
  if (type === "cpf") return maskCpf(value);
  if (type === "email") {
    const [name = "", domain = ""] = value.split("@");
    return `${name.slice(0, 2)}***@${domain}`;
  }
  if (type === "telefone") {
    const digits = onlyDigits(value);
    return digits.length >= 4 ? `***${digits.slice(-4)}` : "Telefone configurado";
  }
  return "Chave configurada";
}

function inPeriod(dateValue: string | null | undefined, start: Date, end: Date) {
  if (!dateValue) return false;
  const time = new Date(dateValue).getTime();
  return Number.isFinite(time) && time >= start.getTime() && time <= end.getTime();
}

function rangeLabel(date: Date, range: PlatformRange) {
  if (range === "365d") {
    return new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "");
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function buildPlatformSeries(
  range: PlatformRange,
  transactions: PlatformWalletTransaction[],
  students: Profile[],
) {
  const config: Record<PlatformRange, { days: number; buckets: number }> = {
    "30d": { days: 30, buckets: 6 },
    "90d": { days: 90, buckets: 6 },
    "365d": { days: 365, buckets: 12 },
  };
  const { days, buckets } = config[range];
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - days + 1);
  start.setHours(0, 0, 0, 0);
  const bucketMs = (end.getTime() - start.getTime()) / buckets;

  return Array.from({ length: buckets }, (_, index) => {
    const periodStart = new Date(start.getTime() + bucketMs * index);
    const periodEnd =
      index === buckets - 1 ? end : new Date(start.getTime() + bucketMs * (index + 1) - 1);
    const platformFees = transactions
      .filter(
        (item) =>
          item.transaction_type === "subscription_fee" &&
          readAmount(item.amount) > 0 &&
          inPeriod(item.created_at, periodStart, periodEnd),
      )
      .reduce((sum, item) => sum + readAmount(item.amount), 0);
    const studentSignups = students.filter((student) =>
      inPeriod(student.created_at, periodStart, periodEnd),
    ).length;

    return {
      label: rangeLabel(periodStart, range),
      periodStart: periodStart.toISOString(),
      platformFees: toMoney(platformFees),
      studentSignups,
    };
  });
}

function buildPlanRanking(subscriptions: SubscriptionWithPlan[]) {
  const paidStatuses = new Set(["ativa", "inadimplente", "cancelada"]);
  const ranking = new Map<
    string,
    {
      planId: string;
      planName: string;
      subscriptions: number;
      revenue: number;
      platformFees: number;
    }
  >();

  subscriptions
    .filter((subscription) => paidStatuses.has(subscription.status))
    .forEach((subscription) => {
      const plan = subscription.subscription_plans;
      const customPlan = subscription.teacher_custom_plans;
      const planId =
        plan?.id ??
        customPlan?.id ??
        subscription.plan_id ??
        subscription.custom_plan_id ??
        "sem-plano";
      const current = ranking.get(planId) ?? {
        planId,
        planName: plan?.name ?? customPlan?.name ?? "Plano",
        subscriptions: 0,
        revenue: 0,
        platformFees: 0,
      };
      const price = readAmount(plan?.price ?? customPlan?.price);
      current.subscriptions += 1;
      current.revenue += price;
      current.platformFees += price * 0.1;
      ranking.set(planId, current);
    });

  return Array.from(ranking.values())
    .map((item) => ({
      ...item,
      revenue: toMoney(item.revenue),
      platformFees: toMoney(item.platformFees),
    }))
    .sort((a, b) => b.subscriptions - a.subscriptions || b.revenue - a.revenue);
}

function buildPlatformWalletSummary(
  transactions: PlatformWalletTransaction[],
  profiles: Profile[],
  roles: UserRole[],
  subscriptions: SubscriptionWithPlan[],
) {
  const studentIds = new Set(
    roles.filter((role) => role.role === "aluno").map((role) => role.user_id),
  );
  const studentProfiles = profiles.filter((profile) => studentIds.has(profile.id));
  const totalPlatformFees = transactions
    .filter((item) => item.transaction_type === "subscription_fee" && readAmount(item.amount) > 0)
    .reduce((sum, item) => sum + readAmount(item.amount), 0);
  const totalWithdrawn = transactions
    .filter((item) => item.transaction_type === "manual_adjustment" && readAmount(item.amount) < 0)
    .reduce((sum, item) => sum + Math.abs(readAmount(item.amount)), 0);
  const availableBalance = transactions.reduce((sum, item) => sum + readAmount(item.amount), 0);

  return {
    totalPlatformFees: toMoney(totalPlatformFees),
    availableBalance: toMoney(availableBalance),
    totalWithdrawn: toMoney(totalWithdrawn),
    transactionsCount: transactions.length,
    ranges: {
      "30d": buildPlatformSeries("30d", transactions, studentProfiles),
      "90d": buildPlatformSeries("90d", transactions, studentProfiles),
      "365d": buildPlatformSeries("365d", transactions, studentProfiles),
    },
    planRanking: buildPlanRanking(subscriptions),
  };
}

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await requireDirector(context.userId);

    const [
      { data: profiles },
      { data: roles },
      { data: teachers },
      { data: students },
      { data: bookings },
      { data: classes },
      { data: classMembers },
      { data: directorMessages },
      { data: directorAlerts },
      { data: directMessages },
      { data: anonymousReports },
      { data: platformWalletTransactions },
      { data: teacherWalletTransactions },
      { data: teacherWithdrawals },
      { data: teacherPayoutProfiles },
      { data: classMaterials },
      { data: subscriptions },
      { data: discountCoupons },
      { data: couponRedemptions },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("*"),
      supabaseAdmin.from("teacher_profiles").select("*"),
      supabaseAdmin.from("student_profiles").select("*"),
      supabaseAdmin.from("bookings").select("*").order("scheduled_at", { ascending: false }),
      supabaseAdmin.from("class_groups").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("class_members").select("*"),
      supabaseAdmin
        .from("director_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("director_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("director_user_messages")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(500),
      supabaseAdmin
        .from("anonymous_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("platform_wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("teacher_wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabaseAdmin
        .from("teacher_withdrawal_requests")
        .select("*")
        .order("requested_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("teacher_payout_profiles").select("*"),
      supabaseAdmin
        .from("class_materials")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("student_subscriptions")
        .select(
          "id, student_id, teacher_id, plan_id, custom_plan_id, status, created_at, current_period_end, cancel_at_period_end, cancel_requested_at, package_type, package_months, package_total_amount, subscription_plans(id, name, price, slug), teacher_custom_plans(id, name, price)",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("discount_coupons")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin
        .from("coupon_redemptions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

    const walletTransactions = (platformWalletTransactions ?? []) as PlatformWalletTransaction[];
    const subscriptionRows = (subscriptions ?? []) as unknown as SubscriptionWithPlan[];

    return {
      profiles: profiles ?? [],
      roles: roles ?? [],
      teachers: teachers ?? [],
      students: students ?? [],
      bookings: bookings ?? [],
      classes: classes ?? [],
      classMembers: classMembers ?? [],
      directorMessages: directorMessages ?? [],
      directorAlerts: directorAlerts ?? [],
      directMessages: directMessages ?? [],
      anonymousReports: anonymousReports ?? [],
      subscriptions: subscriptionRows,
      platformWalletTransactions: walletTransactions,
      teacherWalletTransactions: (teacherWalletTransactions ?? []) as TeacherWalletTransaction[],
      teacherWithdrawals: (teacherWithdrawals ?? []) as TeacherWithdrawalRequest[],
      teacherPayoutProfiles: (teacherPayoutProfiles ?? []) as TeacherPayoutProfile[],
      classMaterials: (classMaterials ?? []) as ClassMaterial[],
      discountCoupons: (discountCoupons ?? []) as DiscountCoupon[],
      couponRedemptions: (couponRedemptions ?? []) as CouponRedemption[],
      platformWalletSummary: buildPlatformWalletSummary(
        walletTransactions,
        (profiles ?? []) as Profile[],
        (roles ?? []) as UserRole[],
        subscriptionRows,
      ),
    };
  });

export const cancelStudentSubscriptionByDirector = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => cancelSubscriptionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);
    const { data: subscription, error: lookupError } = await supabaseAdmin
      .from("student_subscriptions")
      .select("id, status, current_period_end")
      .eq("id", data.subscriptionId)
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
        cancel_reason: data.reason || "Cancelamento feito pela diretoria",
        updated_at: now,
      })
      .eq("id", data.subscriptionId);

    if (updateError) throw new Error(updateError.message);

    return { ok: true, accessUntil: subscription.current_period_end };
  });

export const activateStudentSubscriptionManually = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => activateSubscriptionSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from("student_subscriptions")
      .select("id, status")
      .eq("id", data.subscriptionId)
      .maybeSingle();

    if (subscriptionError || !subscription) {
      throw new Error(subscriptionError?.message ?? "Assinatura nao encontrada.");
    }

    if (subscription.status === "ativa") {
      return { ok: true, alreadyActive: true };
    }

    if (subscription.status !== "pendente") {
      throw new Error("Apenas assinaturas no aguardo podem ser ativadas manualmente.");
    }

    const activation = await activateStudentSubscriptionServer({
      subscriptionId: data.subscriptionId,
      periodStart: new Date().toISOString(),
      periodEnd: null,
      paymentReference: `manual-admin-${data.subscriptionId}`,
      teacherDescription: "Credito de assinatura paga manualmente",
      platformDescription: "Taxa da plataforma sobre assinatura paga manualmente",
    });

    const activationResult = activation[0];

    await Promise.all([
      activationResult?.teacher_transaction_id
        ? supabaseAdmin
            .from("teacher_wallet_transactions")
            .update({ description: "Credito de assinatura paga manualmente" })
            .eq("id", activationResult.teacher_transaction_id)
        : Promise.resolve(),
      activationResult?.platform_transaction_id
        ? supabaseAdmin
            .from("platform_wallet_transactions")
            .update({ description: "Taxa da plataforma sobre assinatura paga manualmente" })
            .eq("id", activationResult.platform_transaction_id)
        : Promise.resolve(),
    ]);

    return { ok: true, activation };
  });

export const requestDirectorWithdrawal = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => directorWithdrawalSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);
    const amount = toMoney(data.amount);

    if (amount <= 0) {
      throw new Error("Informe um valor maior que zero.");
    }

    const { data: balanceRows, error: balanceError } = await supabaseAdmin
      .from("platform_wallet_transactions")
      .select("amount")
      .range(0, 9999);

    if (balanceError) throw new Error(balanceError.message);

    const availableBalance = toMoney(
      (balanceRows ?? []).reduce((sum, item) => sum + readAmount(item.amount), 0),
    );

    if (amount > availableBalance) {
      throw new Error("Valor maior que o saldo disponivel da plataforma.");
    }

    const note = data.note?.trim();
    const pixKeyType = inferPixKeyType(data.pixKey);
    const destinationLabel = `${data.accountHolderName.trim()} | ${pixKeyType.toUpperCase()} ${maskPixKey(data.pixKey, pixKeyType)}`;
    const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
      .from("platform_withdrawal_requests")
      .insert({
        amount,
        pix_key_type: pixKeyType,
        pix_key: data.pixKey.trim(),
        account_holder_name: data.accountHolderName.trim(),
        requested_by: context.userId,
        status: "pendente",
      })
      .select("id")
      .single();

    if (withdrawalError || !withdrawal) {
      throw new Error(withdrawalError?.message ?? "Nao foi possivel criar o saque da plataforma.");
    }

    const { data: walletTransaction, error: walletError } = await supabaseAdmin
      .from("platform_wallet_transactions")
      .insert({
        transaction_type: "manual_adjustment",
        amount: -amount,
        gross_amount: null,
        fee_rate: 0.1,
        description: note
          ? `Saque da diretoria para ${destinationLabel}: ${note}`
          : `Saque da diretoria para ${destinationLabel}`,
        created_by: context.userId,
      })
      .select("id")
      .single();

    if (walletError || !walletTransaction) {
      await supabaseAdmin
        .from("platform_withdrawal_requests")
        .update({
          status: "falhou",
          payout_error: walletError?.message ?? "Falha ao registrar transacao da carteira.",
        })
        .eq("id", withdrawal.id);
      throw new Error(walletError?.message ?? "Falha ao registrar transacao da carteira.");
    }

    await supabaseAdmin
      .from("platform_withdrawal_requests")
      .update({
        wallet_transaction_id: walletTransaction.id,
        payout_provider: "manual",
        payout_error: "Saque registrado para transferencia manual pela diretoria.",
      })
      .eq("id", withdrawal.id);

    return {
      ok: true,
      queued: true,
      provider: "manual",
      status: "pendente" as WithdrawalStatus,
      message: "Saque registrado para transferencia manual.",
    };

    /* Legacy gateway payout removed while the platform uses manual withdrawals.
      const transfer = await createValidapayPixWithdrawal({
        amount,
        pixKey: data.pixKey,
      });
      const status = mapValidapayWithdrawalStatus(transfer.status) as WithdrawalStatus;
      const now = new Date().toISOString();

      const { error: updateError } = await supabaseAdmin
        .from("platform_withdrawal_requests")
        .update({
          status,
          payout_provider: "validapay",
          payout_external_id: transfer.withdrawalId,
          payout_external_status: transfer.status ?? null,
          payout_response: transfer as unknown as Json,
          payout_error: null,
          payout_requested_at: now,
          payout_receipt_url: transfer.receiptUrl ?? null,
          processed_at: now,
          paid_at: status === "pago" ? now : null,
        })
        .eq("id", withdrawal.id);

      if (updateError) throw new Error(updateError.message);

      return { ok: true, provider: "validapay", transferId: transfer.withdrawalId, status };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar Pix pela ValidaPay.";
      if (isValidapayInsufficientBalanceError(err)) {
        const now = new Date().toISOString();
        await supabaseAdmin
          .from("platform_withdrawal_requests")
          .update({
            status: "em_processamento",
            payout_provider: "validapay",
            payout_error: VALIDAPAY_WAITING_BALANCE_MESSAGE,
            payout_requested_at: now,
            processed_at: null,
          })
          .eq("id", withdrawal.id);

        return {
          ok: true,
          queued: true,
          provider: "validapay",
          status: "em_processamento" as WithdrawalStatus,
          message: VALIDAPAY_WAITING_BALANCE_MESSAGE,
        };
      }

      await supabaseAdmin
        .from("platform_withdrawal_requests")
        .update({
          status: "falhou",
          payout_provider: "validapay",
          payout_error: message.slice(0, 500),
          processed_at: new Date().toISOString(),
        })
        .eq("id", withdrawal.id);
      await supabaseAdmin.from("platform_wallet_transactions").insert({
        transaction_type: "manual_adjustment",
        amount,
        gross_amount: null,
        fee_rate: 0.1,
        description: `Reversão automática de saque da diretoria para ${destinationLabel}`,
        created_by: context.userId,
      });
      throw new Error(message);
    }
    */
  });

export const confirmTeacherWithdrawal = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => confirmTeacherWithdrawalSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);
    const now = new Date().toISOString();

    const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
      .from("teacher_withdrawal_requests")
      .select("id, status")
      .eq("id", data.withdrawalId)
      .maybeSingle();

    if (withdrawalError || !withdrawal) {
      throw new Error(withdrawalError?.message ?? "Solicitacao de saque nao encontrada.");
    }

    if (withdrawal.status === "pago") {
      return { ok: true, alreadyPaid: true };
    }

    if (!["pendente", "em_processamento"].includes(withdrawal.status)) {
      throw new Error("Apenas saques pendentes podem ser confirmados.");
    }

    const { error } = await supabaseAdmin
      .from("teacher_withdrawal_requests")
      .update({
        status: "pago",
        payout_provider: "manual",
        payout_error: null,
        payout_external_status: "manual_paid",
        processed_at: now,
        paid_at: now,
        admin_notes: "Saque confirmado manualmente pela diretoria.",
      })
      .eq("id", data.withdrawalId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createDirectorMessage = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => messageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);
    const target = normalizeTarget(data);

    const { data: message, error } = await supabaseAdmin
      .from("director_messages")
      .insert({
        ...target,
        created_by: context.userId,
        title: data.title,
        body: data.body,
        priority: data.priority,
      })
      .select("*")
      .single();

    if (error || !message)
      throw new Error(error?.message ?? "Não foi possível enviar o comunicado.");
    return { message };
  });

export const createDirectorAlert = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => alertSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);
    const target = normalizeTarget(data);

    const { data: alert, error } = await supabaseAdmin
      .from("director_alerts")
      .insert({
        ...target,
        created_by: context.userId,
        title: data.title,
        body: data.body,
        tone: data.tone,
        active: data.active,
        expires_at: data.expiresAt ?? null,
      })
      .select("*")
      .single();

    if (error || !alert) throw new Error(error?.message ?? "Não foi possível criar o alerta.");
    return { alert };
  });

export const updateDirectorAlertStatus = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => alertStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);
    const { error } = await supabaseAdmin
      .from("director_alerts")
      .update({ active: data.active })
      .eq("id", data.alertId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendDirectorDirectMessage = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => directMessageSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);

    const { data: message, error } = await supabaseAdmin
      .from("director_user_messages")
      .insert({
        user_id: data.userId,
        sender_id: context.userId,
        body: data.body,
      })
      .select("*")
      .single();

    if (error || !message) throw new Error(error?.message ?? "Não foi possível enviar a mensagem.");
    return { message };
  });

export const updateAnonymousReport = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => updateReportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireDirector(context.userId);
    const { error } = await supabaseAdmin
      .from("anonymous_reports")
      .update({
        status: data.status,
        admin_notes: data.adminNotes ?? null,
      })
      .eq("id", data.reportId);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDirectorInbox = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const now = new Date().toISOString();

    const [
      { data: roleRows },
      { data: studentClassRows },
      { data: teacherClassRows },
      { data: messages },
      { data: reads },
      { data: alerts },
      { data: directMessages },
    ] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
      supabaseAdmin
        .from("class_members")
        .select("class_id")
        .eq("student_id", userId)
        .eq("status", "ativo"),
      supabaseAdmin
        .from("class_groups")
        .select("id")
        .eq("teacher_id", userId)
        .eq("status", "ativa"),
      supabaseAdmin
        .from("director_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80),
      supabaseAdmin.from("director_message_reads").select("*").eq("user_id", userId),
      supabaseAdmin
        .from("director_alerts")
        .select("*")
        .eq("active", true)
        .lte("starts_at", now)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("director_user_messages")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(100),
    ]);

    const roles = (roleRows ?? []).map((row) => row.role as AppRole);
    const classIds = new Set<string>([
      ...(studentClassRows ?? []).map((row) => row.class_id),
      ...(teacherClassRows ?? []).map((row) => row.id),
    ]);
    const readIds = new Set((reads ?? []).map((read) => read.message_id));

    const targetedMessages = ((messages ?? []) as Array<Tables<"director_messages">>).filter(
      (item) => isTargetedToUser(item as DirectorTarget, userId, roles, classIds),
    );
    const targetedAlerts = ((alerts ?? []) as Array<Tables<"director_alerts">>).filter((item) =>
      isTargetedToUser(item as DirectorTarget, userId, roles, classIds),
    );

    return {
      messages: targetedMessages.map((message) => ({
        ...message,
        read: readIds.has(message.id),
      })),
      alerts: targetedAlerts,
      directMessages: directMessages ?? [],
      unreadCount: targetedMessages.filter((message) => !readIds.has(message.id)).length,
    };
  });

export const markDirectorMessageRead = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => readSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("director_message_reads").upsert({
      message_id: data.messageId,
      user_id: context.userId,
      read_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const replyToDirector = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        body: z.string().trim().min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: message, error } = await supabaseAdmin
      .from("director_user_messages")
      .insert({
        user_id: context.userId,
        sender_id: context.userId,
        body: data.body,
      })
      .select("*")
      .single();

    if (error || !message) throw new Error(error?.message ?? "Não foi possível enviar a resposta.");
    return { message };
  });

export const createAnonymousReport = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => reportSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("anonymous_reports").insert({
      category: data.category,
      title: data.title,
      body: data.body,
    });

    if (error) throw new Error(error.message);
    return { ok: true };
  });
