import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

type Plan = Database["public"]["Tables"]["subscription_plans"]["Row"];
type Profile = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "full_name" | "age" | "cpf" | "email"
>;
type StudentProfile = Pick<
  Database["public"]["Tables"]["student_profiles"]["Row"],
  "desired_language" | "comprehension_level"
>;

const PLATFORM_WHATSAPP_NUMBER = "5571988221450";

function valueOrPending(value: string | number | null | undefined) {
  const text = String(value ?? "").trim();
  return text || "nao informado";
}

function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function buildWhatsappMessage(input: {
  subscriptionId: string;
  plan: Plan;
  student: Profile;
  studentProfile: StudentProfile;
  teacher: Profile;
}) {
  return [
    `ola sou o ${valueOrPending(input.student.full_name)}, quero assinar o plano ${input.plan.name}, esses sao meus dados:`,
    "",
    `Nome completo: ${valueOrPending(input.student.full_name)}`,
    `Idade: ${valueOrPending(input.student.age)}`,
    `CPF: ${valueOrPending(input.student.cpf)}`,
    `Email: ${valueOrPending(input.student.email)}`,
    `Lingua que escolhi aprender: ${valueOrPending(input.studentProfile.desired_language)}`,
    `Nivel de entendimento: ${valueOrPending(input.studentProfile.comprehension_level)}`,
    `Professor selecionado: ${valueOrPending(input.teacher.full_name)}`,
    `CPF do professor selecionado: ${valueOrPending(input.teacher.cpf)}`,
    `Plano escolhido: ${input.plan.name}`,
    `Valor do plano: ${formatMoney(Number(input.plan.price || 0))}`,
    `Codigo da solicitacao: ${input.subscriptionId}`,
  ].join("\n");
}

function whatsappUrl(message: string) {
  return `https://wa.me/${PLATFORM_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const createSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        planSlug: z.string().min(1).max(60),
        teacherId: z.string().uuid(),
        termsAccepted: z.literal(true),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const [
      { data: plan, error: planError },
      { data: teacherProfile, error: teacherProfileError },
      { data: student, error: studentError },
      { data: studentProfile, error: studentProfileError },
      { data: teacher, error: teacherError },
    ] = await Promise.all([
      supabaseAdmin
        .from("subscription_plans")
        .select("*")
        .eq("slug", data.planSlug)
        .eq("is_active", true)
        .maybeSingle(),
      supabaseAdmin
        .from("teacher_profiles")
        .select("id, is_active")
        .eq("id", data.teacherId)
        .eq("is_active", true)
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("full_name, age, cpf, email")
        .eq("id", userId)
        .maybeSingle<Profile>(),
      supabaseAdmin
        .from("student_profiles")
        .select("desired_language, comprehension_level")
        .eq("id", userId)
        .maybeSingle<StudentProfile>(),
      supabaseAdmin
        .from("profiles")
        .select("full_name, age, cpf, email")
        .eq("id", data.teacherId)
        .maybeSingle<Profile>(),
    ]);

    if (planError || !plan) throw new Error("Plano nao encontrado.");
    if (teacherProfileError || !teacherProfile)
      throw new Error("Professor nao encontrado ou inativo.");
    if (studentError || !student)
      throw new Error("Complete seu cadastro de aluno antes de solicitar a assinatura.");
    if (studentProfileError || !studentProfile)
      throw new Error("Complete seu perfil de aluno antes de solicitar a assinatura.");
    if (teacherError || !teacher) throw new Error("Dados do professor nao encontrados.");

    const now = new Date().toISOString();
    const { data: existingPending, error: existingError } = await supabaseAdmin
      .from("student_subscriptions")
      .select("id")
      .eq("student_id", userId)
      .eq("teacher_id", data.teacherId)
      .eq("plan_id", plan.id)
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    let subscriptionId = existingPending?.id;
    const payload = {
      manual_request: true,
      channel: "whatsapp",
      whatsapp_number: PLATFORM_WHATSAPP_NUMBER,
      requested_at: now,
    } as Json;

    if (subscriptionId) {
      const { error: updateError } = await supabaseAdmin
        .from("student_subscriptions")
        .update({
          terms_accepted_at: now,
          terms_version: "v1",
          validapay_payload: payload,
        })
        .eq("id", subscriptionId);

      if (updateError) throw new Error(updateError.message);
    } else {
      const { data: created, error: createError } = await supabaseAdmin
        .from("student_subscriptions")
        .insert({
          student_id: userId,
          teacher_id: data.teacherId,
          plan_id: plan.id,
          status: "pendente",
          payment_method: null,
          terms_accepted_at: now,
          terms_version: "v1",
          validapay_payload: payload,
        })
        .select("id")
        .single();

      if (createError || !created) {
        throw new Error(createError?.message ?? "Falha ao registrar solicitacao de assinatura.");
      }

      subscriptionId = created.id;
    }

    if (!subscriptionId) throw new Error("Falha ao registrar solicitacao de assinatura.");

    const message = buildWhatsappMessage({
      subscriptionId,
      plan,
      student,
      studentProfile,
      teacher,
    });

    return {
      url: whatsappUrl(message),
      subscriptionId,
      channel: "whatsapp",
      status: "pendente",
    };
  });

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;
    const { data } = await supabaseAdmin
      .from("student_subscriptions")
      .select(
        "id, status, payment_method, current_period_start, current_period_end, cancel_at_period_end, last_payment_at, terms_accepted_at, terms_version, created_at, updated_at, subscription_plans(*)",
      )
      .eq("student_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { subscription: data };
  });
