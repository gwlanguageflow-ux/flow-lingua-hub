DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_package') THEN
    CREATE TYPE public.subscription_package AS ENUM ('mensal', 'semestral', 'anual');
  END IF;
END
$$;

ALTER TABLE public.student_subscriptions
  ADD COLUMN IF NOT EXISTS package_type public.subscription_package NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS package_months integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS package_discount_rate numeric(5,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS package_base_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS package_total_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

ALTER TABLE public.student_subscriptions
  DROP CONSTRAINT IF EXISTS student_subscriptions_package_months_check,
  ADD CONSTRAINT student_subscriptions_package_months_check
    CHECK (package_months IN (1, 6, 12)),
  DROP CONSTRAINT IF EXISTS student_subscriptions_package_discount_check,
  ADD CONSTRAINT student_subscriptions_package_discount_check
    CHECK (package_discount_rate >= 0 AND package_discount_rate <= 1),
  DROP CONSTRAINT IF EXISTS student_subscriptions_package_amounts_check,
  ADD CONSTRAINT student_subscriptions_package_amounts_check
    CHECK (
      (package_base_amount IS NULL OR package_base_amount > 0)
      AND (package_total_amount IS NULL OR package_total_amount > 0)
    );

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_cancel_period
  ON public.student_subscriptions (cancel_at_period_end, current_period_end)
  WHERE cancel_at_period_end = true;

CREATE TABLE IF NOT EXISTS public.subscription_package_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  custom_plan_id uuid REFERENCES public.teacher_custom_plans(id) ON DELETE CASCADE,
  package_type public.subscription_package NOT NULL,
  coupon_discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  validapay_product_id text,
  validapay_price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscription_package_prices_owner_check
    CHECK ((plan_id IS NOT NULL)::integer + (custom_plan_id IS NOT NULL)::integer = 1),
  CONSTRAINT subscription_package_prices_discount_check
    CHECK (coupon_discount_percent >= 0 AND coupon_discount_percent <= 100)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_package_prices_platform
  ON public.subscription_package_prices (plan_id, package_type, coupon_discount_percent)
  WHERE plan_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_package_prices_custom
  ON public.subscription_package_prices (custom_plan_id, package_type, coupon_discount_percent)
  WHERE custom_plan_id IS NOT NULL;

ALTER TABLE public.subscription_package_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.subscription_package_prices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.subscription_package_prices TO service_role;

DROP TRIGGER IF EXISTS subscription_package_prices_updated ON public.subscription_package_prices;
CREATE TRIGGER subscription_package_prices_updated
  BEFORE UPDATE ON public.subscription_package_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
