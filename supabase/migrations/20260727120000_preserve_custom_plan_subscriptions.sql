-- Preserve custom teacher plans that are already tied to student subscriptions.
-- A custom plan referenced by a subscription cannot be deleted, otherwise the
-- subscription would violate the plan_id/custom_plan_id exclusivity check.

ALTER TABLE public.student_subscriptions
  DROP CONSTRAINT IF EXISTS student_subscriptions_custom_plan_id_fkey;

ALTER TABLE public.student_subscriptions
  ADD CONSTRAINT student_subscriptions_custom_plan_id_fkey
  FOREIGN KEY (custom_plan_id)
  REFERENCES public.teacher_custom_plans(id)
  ON DELETE RESTRICT;
