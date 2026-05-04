import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripe } from "./stripe.server";

/**
 * Cria (ou recupera) a conta Stripe Express do professor e retorna
 * uma URL de onboarding. O professor é redirecionado para o Stripe
 * preencher dados bancários e KYC.
 */
export const createTeacherOnboardingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { returnUrl: string; refreshUrl: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const stripe = getStripe();

    // Busca perfil professor
    const { data: profile, error } = await supabase
      .from("teacher_profiles")
      .select("stripe_account_id")
      .eq("id", userId)
      .single();
    if (error) throw new Error("Perfil de professor não encontrado");

    let accountId = profile.stripe_account_id;

    // Cria conta Express se ainda não existe
    if (!accountId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", userId)
        .single();

      const account = await stripe.accounts.create({
        type: "express",
        country: "BR",
        email: prof?.email ?? undefined,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        business_type: "individual",
        metadata: { teacher_id: userId },
      });
      accountId = account.id;

      await supabase
        .from("teacher_profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", userId);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: data.refreshUrl,
      return_url: data.returnUrl,
      type: "account_onboarding",
    });

    return { url: link.url };
  });

/**
 * Verifica status da conta Connect do professor (charges_enabled etc.)
 * e atualiza no banco.
 */
export const refreshTeacherStripeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const stripe = getStripe();

    const { data: profile } = await supabase
      .from("teacher_profiles")
      .select("stripe_account_id")
      .eq("id", userId)
      .single();

    if (!profile?.stripe_account_id) {
      return { connected: false, chargesEnabled: false, onboardingComplete: false };
    }

    const account = await stripe.accounts.retrieve(profile.stripe_account_id);
    const onboardingComplete = !!account.details_submitted;
    const chargesEnabled = !!account.charges_enabled;

    await supabase
      .from("teacher_profiles")
      .update({
        stripe_onboarding_complete: onboardingComplete,
        stripe_charges_enabled: chargesEnabled,
      })
      .eq("id", userId);

    return { connected: true, chargesEnabled, onboardingComplete };
  });
