DROP POLICY IF EXISTS "Plans public read" ON public.subscription_plans;
CREATE POLICY "Plans public read" ON public.subscription_plans FOR SELECT TO anon, authenticated USING (true);