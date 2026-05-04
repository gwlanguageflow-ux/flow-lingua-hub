import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getStripe, PLATFORM_FEE_PCT } from "./stripe.server";

/**
 * Cria uma Checkout Session com split automático 9% / 91%.
 * O aluno paga; o valor cai direto na conta Connect do professor,
 * com a plataforma retendo 9% via application_fee_amount.
 *
 * Cria também um booking pendente que será confirmado pelo webhook
 * após o pagamento.
 */
export const createBookingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      teacherId: string;
      scheduledAt: string; // ISO
      durationMinutes: number;
      amount: number; // em reais (ex 80.00)
      successUrl: string;
      cancelUrl: string;
      notes?: string;
    }) => input
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const stripe = getStripe();

    // Verifica conta Connect do professor
    const { data: teacher, error: tErr } = await supabase
      .from("teacher_profiles")
      .select("stripe_account_id, stripe_charges_enabled")
      .eq("id", data.teacherId)
      .single();
    if (tErr || !teacher?.stripe_account_id || !teacher.stripe_charges_enabled) {
      throw new Error("O professor ainda não está habilitado a receber pagamentos.");
    }

    const totalCents = Math.round(data.amount * 100);
    const platformFeeCents = Math.round(totalCents * PLATFORM_FEE_PCT);
    const teacherPayoutCents = totalCents - platformFeeCents;

    // Cria booking pendente
    const { data: booking, error: bErr } = await supabase
      .from("bookings")
      .insert({
        student_id: userId,
        teacher_id: data.teacherId,
        scheduled_at: data.scheduledAt,
        duration_minutes: data.durationMinutes,
        total_amount: data.amount,
        platform_fee: platformFeeCents / 100,
        teacher_payout: teacherPayoutCents / 100,
        status: "pendente",
        notes: data.notes ?? null,
      })
      .select("id")
      .single();
    if (bErr || !booking) throw new Error("Falha ao criar agendamento");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: totalCents,
            product_data: {
              name: `Aula de ${data.durationMinutes} min — GWLanguageFlow`,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: platformFeeCents,
        transfer_data: { destination: teacher.stripe_account_id },
        metadata: { booking_id: booking.id },
      },
      metadata: { booking_id: booking.id },
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
    });

    await supabase
      .from("bookings")
      .update({ stripe_session_id: session.id, payment_intent_id: session.payment_intent as string | null })
      .eq("id", booking.id);

    return { url: session.url, bookingId: booking.id };
  });
