import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sanitizeText } from "@/lib/sanitize";
import { writeAuditLog, writeSecurityEvent } from "@/server/compliance.server";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Nome muito curto").max(120),
  email: z.string().trim().email("E-mail inválido").max(255),
  password: z.string().min(6, "Senha precisa ter ao menos 6 caracteres").max(128),
});

export const createConfirmedAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signupSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();
    const fullName = sanitizeText(data.fullName, 120);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (error || !created.user) {
      const message = error?.message ?? "Não foi possível criar a conta.";
      await writeSecurityEvent({
        eventType: "auth.signup_failure",
        severity: "medium",
        route: "/auth/signup",
        metadata: { emailDomain: email.split("@")[1] ?? "desconhecido", message },
      });
      if (
        message.toLowerCase().includes("already") ||
        message.toLowerCase().includes("registered")
      ) {
        throw new Error("E-mail já cadastrado.");
      }
      throw new Error(message);
    }

    await supabaseAdmin.from("profiles").upsert(
      {
        id: created.user.id,
        email,
        full_name: fullName,
      },
      { onConflict: "id" },
    );

    await writeAuditLog({
      actorUserId: created.user.id,
      action: "auth.signup_confirmed_account",
      entityType: "auth.users",
      entityId: created.user.id,
      metadata: { emailDomain: email.split("@")[1] ?? "desconhecido" },
    });

    return { userId: created.user.id };
  });
