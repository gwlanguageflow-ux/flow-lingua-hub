import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeCpf, isValidCpf } from "@/lib/cpf";

const identitySchema = z.object({
  email: z.string().trim().email("E-mail inválido").max(255),
  cpf: z.string().transform((value, ctx) => {
    const cpf = normalizeCpf(value);
    if (!isValidCpf(cpf)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Informe um CPF válido" });
      return z.NEVER;
    }
    return cpf;
  }),
});

const resetSchema = identitySchema.extend({
  password: z.string().min(6, "Senha precisa ter ao menos 6 caracteres").max(128),
});

async function findUserByEmailAndCpf(email: string, cpf: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const normalizedEmail = email.trim().toLowerCase();

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, cpf")
    .eq("email", normalizedEmail)
    .eq("cpf", cpf)
    .maybeSingle();

  if (error || !profile) {
    throw new Error("E-mail e CPF não conferem.");
  }

  return { supabaseAdmin, userId: profile.id, email: normalizedEmail };
}

export const verifyPasswordResetIdentity = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => identitySchema.parse(input))
  .handler(async ({ data }) => {
    await findUserByEmailAndCpf(data.email, data.cpf);
    return { verified: true };
  });

export const resetPasswordWithCpf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => resetSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin, userId, email } = await findUserByEmailAndCpf(data.email, data.cpf);

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.password,
      email_confirm: true,
    });

    if (error) {
      throw new Error("Não foi possível atualizar a senha agora.");
    }

    return { email };
  });
