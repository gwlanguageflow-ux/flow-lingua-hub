DROP POLICY IF EXISTS "Authenticated users create anonymous reports"
  ON public.anonymous_reports;

CREATE POLICY "Authenticated users create anonymous reports"
  ON public.anonymous_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
