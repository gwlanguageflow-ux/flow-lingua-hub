import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  createValidapayPixWithdrawal,
  isValidapayInsufficientBalanceError,
  mapValidapayWithdrawalStatus,
  requireValidapayConfig,
  VALIDAPAY_WAITING_BALANCE_MESSAGE,
} from "@/server/validapay.server";

type PixKeyType = Database["public"]["Enums"]["pix_key_type"];
type WithdrawalStatus = Database["public"]["Enums"]["teacher_withdrawal_status"];

const teacherWithdrawalSchema = z.object({
  amount: z.coerce.number().positive(),
  accountHolderName: z.string().trim().min(2).max(160),
  pixKey: z.string().trim().min(3).max(200),
});

function toMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function inferPixKeyType(value: string): PixKeyType {
  const trimmed = value.trim();
  const digits = onlyDigits(trimmed);
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "email";
  if (digits.length === 11) return "cpf";
  if (digits.length >= 10 && digits.length <= 13) return "telefone";
  return "aleatoria";
}

async function reverseTeacherWithdrawalHold(input: {
  teacherId: string;
  withdrawalId: string;
  amount: number;
  userId: string;
  reason: string;
}) {
  const { error: updateError } = await supabaseAdmin
    .from("teacher_withdrawal_requests")
    .update({
      status: "falhou",
      payout_provider: "validapay",
      payout_error: input.reason.slice(0, 500),
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.withdrawalId);

  if (updateError) throw new Error(updateError.message);

  const { data: existingReversal, error: reversalLookupError } = await supabaseAdmin
    .from("teacher_wallet_transactions")
    .select("id")
    .eq("withdrawal_request_id", input.withdrawalId)
    .eq("transaction_type", "withdrawal_reversal")
    .maybeSingle();

  if (reversalLookupError) throw new Error(reversalLookupError.message);
  if (existingReversal) return;

  const { error: reversalError } = await supabaseAdmin.from("teacher_wallet_transactions").insert({
    teacher_id: input.teacherId,
    withdrawal_request_id: input.withdrawalId,
    transaction_type: "withdrawal_reversal",
    amount: input.amount,
    description: "Reversão automática de saque Pix não enviado",
    created_by: input.userId,
  });

  if (reversalError) throw new Error(reversalError.message);
}

export const requestTeacherWithdrawal = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => teacherWithdrawalSchema.parse(input))
  .handler(async ({ data, context }) => {
    requireValidapayConfig();

    const amount = toMoney(data.amount);
    if (amount <= 0) throw new Error("Informe um valor maior que zero.");

    const { data: withdrawalId, error: rpcError } = await supabaseAdmin.rpc(
      "create_teacher_withdrawal_request",
      {
        _teacher_id: context.userId,
        _amount: amount,
        _pix_key_type: inferPixKeyType(data.pixKey),
        _pix_key: data.pixKey.trim(),
        _account_holder_name: data.accountHolderName.trim(),
        _account_holder_document: null,
        _teacher_notes: null,
      },
    );

    if (rpcError || !withdrawalId) {
      throw new Error(rpcError?.message ?? "Nao foi possivel criar o saque.");
    }

    try {
      const transfer = await createValidapayPixWithdrawal({
        amount,
        pixKey: data.pixKey,
      });
      const status = mapValidapayWithdrawalStatus(transfer.status) as WithdrawalStatus;
      const now = new Date().toISOString();

      const { error: updateError } = await supabaseAdmin
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
        })
        .eq("id", withdrawalId);

      if (updateError) throw new Error(updateError.message);

      return {
        ok: true,
        withdrawalId,
        provider: "validapay",
        transferId: transfer.withdrawalId,
        status,
      };
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : "Falha ao enviar Pix pela ValidaPay.";
      if (isValidapayInsufficientBalanceError(err)) {
        const now = new Date().toISOString();
        const { error: queueError } = await supabaseAdmin
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

        if (queueError) throw new Error(queueError.message);

        return {
          ok: true,
          queued: true,
          withdrawalId,
          provider: "validapay",
          status: "em_processamento" as WithdrawalStatus,
          message: VALIDAPAY_WAITING_BALANCE_MESSAGE,
        };
      }

      const message = rawMessage;
      await reverseTeacherWithdrawalHold({
        teacherId: context.userId,
        withdrawalId,
        amount,
        userId: context.userId,
        reason: message,
      });
      throw new Error(message);
    }
  });
