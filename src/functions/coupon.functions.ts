import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const teacherCouponSchema = z.object({
  discountPercent: z.coerce.number().int().min(1).max(80),
  active: z.boolean().default(true),
});

const directorCouponSchema = z.object({
  prefix: z
    .string()
    .trim()
    .min(4)
    .max(4)
    .transform((value) => normalizeLetters(value).slice(0, 4))
    .refine((value) => /^[A-Z]{4}$/.test(value), "Use exatamente 4 letras."),
  discountPercent: z.coerce.number().int().min(1).max(80),
  active: z.boolean().default(true),
  expiresAt: z.string().datetime().optional().nullable(),
  title: z.string().trim().max(120).optional().nullable(),
});

function normalizeLetters(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
}

function percentSuffix(percent: number) {
  return String(percent).padStart(2, "0");
}

function teacherCouponPrefix(name: string | null | undefined) {
  const normalized = normalizeLetters(name ?? "");
  return (normalized + "GWLF").slice(0, 4);
}

async function requireRole(userId: string, roles: Array<"dev" | "professor">) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .in("role", roles)
    .limit(1)
    .maybeSingle();

  if (error || !data) throw new Response("Forbidden", { status: 403 });
  return supabaseAdmin;
}

export const upsertTeacherCoupon = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => teacherCouponSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireRole(context.userId, ["professor", "dev"]);

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error(profileError.message);

    const code = `${teacherCouponPrefix(profile?.full_name)}-${percentSuffix(data.discountPercent)}`;
    const now = new Date().toISOString();

    if (data.active) {
      await supabaseAdmin
        .from("discount_coupons")
        .update({ active: false, updated_at: now })
        .eq("teacher_id", context.userId)
        .eq("scope", "teacher");
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("discount_coupons")
      .select("id")
      .eq("teacher_id", context.userId)
      .eq("scope", "teacher")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);

    const payload = {
      code,
      discount_percent: data.discountPercent,
      scope: "teacher" as const,
      teacher_id: context.userId,
      active: data.active,
      title: data.active
        ? `Cupom do professor com ${data.discountPercent}%`
        : "Cupom do professor pausado",
      created_by: context.userId,
      updated_at: now,
    };

    const query = existing
      ? supabaseAdmin.from("discount_coupons").update(payload).eq("id", existing.id)
      : supabaseAdmin.from("discount_coupons").insert(payload);

    const { data: coupon, error } = await query.select("*").single();
    if (error || !coupon) throw new Error(error?.message ?? "Nao foi possivel salvar o cupom.");

    return { coupon };
  });

export const createDirectorCoupon = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => directorCouponSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await requireRole(context.userId, ["dev"]);
    const code = `${data.prefix}${percentSuffix(data.discountPercent)}`;

    const { data: coupon, error } = await supabaseAdmin
      .from("discount_coupons")
      .upsert(
        {
          code,
          discount_percent: data.discountPercent,
          scope: "director",
          teacher_id: null,
          active: data.active,
          title: data.title || `Cupom da diretoria com ${data.discountPercent}%`,
          created_by: context.userId,
          expires_at: data.expiresAt ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "code" },
      )
      .select("*")
      .single();

    if (error || !coupon) throw new Error(error?.message ?? "Nao foi possivel criar o cupom.");
    return { coupon };
  });
