DROP POLICY IF EXISTS "Teacher creates pending booking" ON public.bookings;

CREATE POLICY "Teacher creates pending booking"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = teacher_id
  AND status = 'pendente'::public.booking_status
  AND EXISTS (
    SELECT 1
    FROM public.student_subscriptions ss
    WHERE ss.student_id = bookings.student_id
      AND ss.teacher_id = bookings.teacher_id
      AND ss.status = 'ativa'::public.subscription_status
      AND (ss.current_period_end IS NULL OR ss.current_period_end > now())
  )
);
