import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { normalizeCpf, isValidCpf } from "@/lib/cpf";
import {
  writeAuditLog,
  writeSecurityEvent,
  writeUserSessionEvent,
} from "@/server/compliance.server";

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
    await writeSecurityEvent({
      eventType: "auth.password_reset_identity_failure",
      severity: "medium",
      route: "/auth/reset-password",
      metadata: { emailDomain: normalizedEmail.split("@")[1] ?? "desconhecido" },
    });
    throw new Error("E-mail e CPF não conferem.");
  }

  return { supabaseAdmin, userId: profile.id, email: normalizedEmail };
}

export const verifyPasswordResetIdentity = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => identitySchema.parse(input))
  .handler(async ({ data }) => {
    const { userId } = await findUserByEmailAndCpf(data.email, data.cpf);
    await writeSecurityEvent({
      userId,
      eventType: "auth.password_reset_identity_verified",
      severity: "low",
      route: "/auth/reset-password",
    });
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
      await writeSecurityEvent({
        userId,
        eventType: "auth.password_reset_failure",
        severity: "high",
        route: "/auth/reset-password",
        metadata: { message: error.message },
      });
      throw new Error("Não foi possível atualizar a senha agora.");
    }

    await writeUserSessionEvent({
      userId,
      event: "password_reset",
      metadata: { method: "cpf_email" },
    });
    await writeAuditLog({
      actorUserId: userId,
      action: "auth.password_reset",
      entityType: "auth.users",
      entityId: userId,
      metadata: { method: "cpf_email" },
    });

    return { email };
  });
