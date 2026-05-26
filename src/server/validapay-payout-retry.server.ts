import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Enums, Json, Tables } from "@/integrations/supabase/types";
import {
  createValidapayPixWithdrawal,
  isValidapayInsufficientBalanceError,
  mapValidapayWithdrawalStatus,
  VALIDAPAY_WAITING_BALANCE_MESSAGE,
} from "@/server/validapay.server";

type WithdrawalStatus = Enums<"teacher_withdrawal_status">;
type TeacherWithdrawal = Pick<
  Tables<"teacher_withdrawal_requests">,
  "id" | "teacher_id" | "amount" | "pix_key"
>;
type PlatformWithdrawal = Pick<
  Tables<"platform_withdrawal_requests">,
  "id" | "amount" | "pix_key" | "requested_by" | "account_holder_name"
>;

async function markTeacherWithdrawalSuccess(
  withdrawalId: string,
  transfer: Awaited<ReturnType<typeof createValidapayPixWithdrawal>>,
) {
  const status = mapValidapayWithdrawalStatus(transfer.status) as WithdrawalStatus;
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("teacher_withdrawal_requests")
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
      updated_at: now,
    })
    .eq("id", withdrawalId);

  if (error) throw error;
}

async function markPlatformWithdrawalSuccess(
  withdrawalId: string,
  transfer: Awaited<ReturnType<typeof createValidapayPixWithdrawal>>,
) {
  const status = mapValidapayWithdrawalStatus(transfer.status) as WithdrawalStatus;
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
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
    .eq("id", withdrawalId);

  if (error) throw error;
}

async function keepTeacherWithdrawalQueued(withdrawalId: string) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("teacher_withdrawal_requests")
    .update({
      status: "em_processamento",
      payout_provider: "validapay",
      payout_error: VALIDAPAY_WAITING_BALANCE_MESSAGE,
      payout_requested_at: now,
      processed_at: null,
      updated_at: now,
    })
    .eq("id", withdrawalId);

  if (error) throw error;
}

async function keepPlatformWithdrawalQueued(withdrawalId: string) {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("platform_withdrawal_requests")
    .update({
      status: "em_processamento",
      payout_provider: "validapay",
      payout_error: VALIDAPAY_WAITING_BALANCE_MESSAGE,
      payout_requested_at: now,
      processed_at: null,
    })
    .eq("id", withdrawalId);

  if (error) throw error;
}

async function failTeacherWithdrawal(row: TeacherWithdrawal, reason: string) {
  const now = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from("teacher_withdrawal_requests")
    .update({
      status: "falhou",
      payout_provider: "validapay",
      payout_error: reason.slice(0, 500),
      processed_at: now,
      updated_at: now,
    })
    .eq("id", row.id);

  if (updateError) throw updateError;

  const { data: existingReversal, error: lookupError } = await supabaseAdmin
    .from("teacher_wallet_transactions")
    .select("id")
    .eq("withdrawal_request_id", row.id)
    .eq("transaction_type", "withdrawal_reversal")
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existingReversal) return;

  const { error: reversalError } = await supabaseAdmin.from("teacher_wallet_transactions").insert({
    teacher_id: row.teacher_id,
    withdrawal_request_id: row.id,
    transaction_type: "withdrawal_reversal",
    amount: row.amount,
    description: "Reversao automatica de saque Pix nao enviado",
    created_by: row.teacher_id,
  });

  if (reversalError) throw reversalError;
}

async function failPlatformWithdrawal(row: PlatformWithdrawal, reason: string) {
  const { error: updateError } = await supabaseAdmin
    .from("platform_withdrawal_requests")
    .update({
      status: "falhou",
      payout_provider: "validapay",
      payout_error: reason.slice(0, 500),
      processed_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  if (updateError) throw updateError;

  const { error: reversalError } = await supabaseAdmin.from("platform_wallet_transactions").insert({
    transaction_type: "manual_adjustment",
    amount: row.amount,
    gross_amount: null,
    fee_rate: 0.1,
    description: `Reversao automatica de saque da diretoria para ${row.account_holder_name}`,
    created_by: row.requested_by,
  });

  if (reversalError) throw reversalError;
}

async function retryTeacherWithdrawals(limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("teacher_withdrawal_requests")
    .select("id, teacher_id, amount, pix_key")
    .in("status", ["pendente", "em_processamento"])
    .is("payout_external_id", null)
    .order("requested_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const result = { scanned: data?.length ?? 0, sent: 0, queued: 0, failed: 0 };
  for (const row of (data ?? []) as TeacherWithdrawal[]) {
    try {
      const transfer = await createValidapayPixWithdrawal({
        amount: Number(row.amount),
        pixKey: row.pix_key,
      });
      await markTeacherWithdrawalSuccess(row.id, transfer);
      result.sent += 1;
    } catch (error) {
      if (isValidapayInsufficientBalanceError(error)) {
        await keepTeacherWithdrawalQueued(row.id);
        result.queued += 1;
      } else {
        const message =
          error instanceof Error ? error.message : "Falha ao enviar Pix pela ValidaPay.";
        await failTeacherWithdrawal(row, message);
        result.failed += 1;
      }
    }
  }

  return result;
}

async function retryPlatformWithdrawals(limit = 20) {
  const { data, error } = await supabaseAdmin
    .from("platform_withdrawal_requests")
    .select("id, amount, pix_key, requested_by, account_holder_name")
    .in("status", ["pendente", "em_processamento"])
    .is("payout_external_id", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;

  const result = { scanned: data?.length ?? 0, sent: 0, queued: 0, failed: 0 };
  for (const row of (data ?? []) as PlatformWithdrawal[]) {
    try {
      const transfer = await createValidapayPixWithdrawal({
        amount: Number(row.amount),
        pixKey: row.pix_key,
      });
      await markPlatformWithdrawalSuccess(row.id, transfer);
      result.sent += 1;
    } catch (error) {
      if (isValidapayInsufficientBalanceError(error)) {
        await keepPlatformWithdrawalQueued(row.id);
        result.queued += 1;
      } else {
        const message =
          error instanceof Error ? error.message : "Falha ao enviar Pix pela ValidaPay.";
        await failPlatformWithdrawal(row, message);
        result.failed += 1;
      }
    }
  }

  return result;
}

export async function runValidapayPayoutRetry() {
  const [teacher, platform] = await Promise.all([
    retryTeacherWithdrawals(),
    retryPlatformWithdrawals(),
  ]);
  return { teacher, platform };
}
