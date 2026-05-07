ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS use_custom_pricing boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_prices jsonb NOT NULL DEFAULT '{}'::jsonb;