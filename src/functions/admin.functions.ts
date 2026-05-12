import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: role, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "dev")
      .maybeSingle();

    if (roleError || !role) {
      throw new Response("Forbidden", { status: 403 });
    }

    const [{ data: profiles }, { data: teachers }, { data: students }, { data: bookings }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*").order("created_at", { ascending: false }),
        supabaseAdmin.from("teacher_profiles").select("*"),
        supabaseAdmin.from("student_profiles").select("*"),
        supabaseAdmin.from("bookings").select("*").order("scheduled_at", { ascending: false }),
      ]);

    return {
      profiles: profiles ?? [],
      teachers: teachers ?? [],
      students: students ?? [],
      bookings: bookings ?? [],
    };
  });
