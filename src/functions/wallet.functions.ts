import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { createAsaasPixTransfer, requireAsaasConfig } from "@/server/asaas.server";

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

function mapTransferStatus(status: string | null | undefined): WithdrawalStatus {
  if (status === "DONE") return "pago";
  if (status === "CANCELLED") return "cancelado";
  return "em_processamento";
}

async function reverseTeacherWithdrawalHold(input: {
  teacherId: string;
  withdrawalId: string;
  amount: number;
  userId: string;
  reason: string;
}) {
  await supabaseAdmin
    .from("teacher_withdrawal_requests")
    .update({
      status: "falhou",
      payout_provider: "asaas",
      payout_error: input.reason.slice(0, 500),
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.withdrawalId);

  await supabaseAdmin.from("teacher_wallet_transactions").insert({
    teacher_id: input.teacherId,
    withdrawal_request_id: input.withdrawalId,
    transaction_type: "withdrawal_reversal",
    amount: input.amount,
    description: "Reversao automatica de saque Pix nao enviado",
    created_by: input.userId,
  });
}

export const requestTeacherWithdrawal = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => teacherWithdrawalSchema.parse(input))
  .handler(async ({ data, context }) => {
    requireAsaasConfig();

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
      const transfer = await createAsaasPixTransfer({
        amount,
        pixKey: data.pixKey,
        description: `Saque professor GWLanguageFlow ${withdrawalId}`,
        externalReference: `teacher-withdrawal:${withdrawalId}`,
      });
      const status = mapTransferStatus(transfer.status);
      const now = new Date().toISOString();

      const { error: updateError } = await supabaseAdmin
        .from("teacher_withdrawal_requests")
        .update({
          status,
          payout_provider: "asaas",
          payout_external_id: transfer.id,
          payout_external_status: transfer.status ?? null,
          payout_response: transfer,
          payout_error: null,
          payout_requested_at: now,
          payout_receipt_url: transfer.transactionReceiptUrl ?? null,
          processed_at: now,
          paid_at: status === "pago" ? now : null,
        })
        .eq("id", withdrawalId);

      if (updateError) throw new Error(updateError.message);

      return {
        ok: true,
        withdrawalId,
        provider: "asaas",
        transferId: transfer.id,
        status,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar Pix pelo Asaas.";
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
