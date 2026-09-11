import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CURRENT_TERMS_VERSION = "2026.05.19";

const acceptanceSchema = z.object({
  signerName: z.string().trim().min(3).max(160),
});

type TermsRole = "professor" | "aluno";

async function getTermsContext(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: profile, error: profileError }, { data: roleRows, error: rolesError }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    ]);

  if (profileError || !profile) throw new Error(profileError?.message ?? "Perfil não encontrado.");
  if (rolesError) throw new Error(rolesError.message);

  const roles = (roleRows ?? [])
    .map((row) => row.role)
    .filter((role): role is TermsRole => role === "professor" || role === "aluno");

  return { supabaseAdmin, fullName: profile.full_name, roles };
}

export const getTermsAcceptanceStatus = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin, fullName, roles } = await getTermsContext(context.userId);
    if (roles.length === 0) return { required: false, roles: [], fullName };

    const { data, error } = await supabaseAdmin
      .from("terms_acceptances")
      .select("role")
      .eq("user_id", context.userId)
      .eq("terms_version", CURRENT_TERMS_VERSION);
    if (error) throw new Error(error.message);

    const acceptedRoles = new Set((data ?? []).map((item) => item.role));
    return {
      required: roles.some((role) => !acceptedRoles.has(role)),
      roles: roles.filter((role) => !acceptedRoles.has(role)),
      fullName,
    };
  });

export const acceptCurrentTerms = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => acceptanceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin, fullName, roles } = await getTermsContext(context.userId);
    if (roles.length === 0) return { ok: true };

    if (data.signerName.localeCompare(fullName, "pt-BR", { sensitivity: "accent" }) !== 0) {
      throw new Error("Digite seu nome completo exatamente como está no cadastro.");
    }

    const { error } = await supabaseAdmin.from("terms_acceptances").upsert(
      roles.map((role) => ({
        user_id: context.userId,
        role,
        terms_version: CURRENT_TERMS_VERSION,
        signer_name: fullName,
        accepted_at: new Date().toISOString(),
      })),
      { onConflict: "user_id,role,terms_version" },
    );
    if (error) throw new Error(error.message);

    return { ok: true };
  });
