import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
      },
    });

    if (error || !created.user) {
      const message = error?.message ?? "Não foi possível criar a conta.";
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
        full_name: data.fullName,
      },
      { onConflict: "id" },
    );

    return { userId: created.user.id };
  });
