-- The has_role helper is used inside several RLS policies. It is intentionally
-- self-scoped (_user_id must equal auth.uid()), so allowing EXECUTE broadly does
-- not expose another user's roles and prevents end-user writes from failing with
-- "permission denied for function has_role" while policies are evaluated.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO PUBLIC, anon, authenticated, service_role;

-- Keep normal role reads independent from the helper. Dev-wide reads are handled
-- by privileged server functions, while users only need to read their own roles
-- in the client session.
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
