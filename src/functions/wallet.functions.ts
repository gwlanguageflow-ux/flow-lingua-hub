import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

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

export const requestTeacherWithdrawal = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => teacherWithdrawalSchema.parse(input))
  .handler(async ({ data, context }) => {
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
        _teacher_notes: "Saque registrado para transferencia manual pela diretoria.",
      },
    );

    if (rpcError || !withdrawalId) {
      throw new Error(rpcError?.message ?? "Nao foi possivel criar o saque.");
    }

    const { error: updateError } = await supabaseAdmin
      .from("teacher_withdrawal_requests")
      .update({
        status: "pendente",
        payout_provider: "manual",
        payout_error: "Saque registrado para transferencia manual pela diretoria.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", withdrawalId);

    if (updateError) throw new Error(updateError.message);

    return {
      ok: true,
      queued: true,
      withdrawalId,
      provider: "manual",
      status: "pendente" as WithdrawalStatus,
      message: "Saque registrado para transferencia manual pela diretoria.",
    };
  });
