ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS validapay_product_id text,
  ADD COLUMN IF NOT EXISTS validapay_price_id text;

ALTER TABLE public.student_subscriptions
  ADD COLUMN IF NOT EXISTS validapay_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS validapay_customer_id text,
  ADD COLUMN IF NOT EXISTS validapay_charge_id text,
  ADD COLUMN IF NOT EXISTS validapay_payment_id text,
  ADD COLUMN IF NOT EXISTS validapay_subscription_id text,
  ADD COLUMN IF NOT EXISTS validapay_payment_status text,
  ADD COLUMN IF NOT EXISTS validapay_payload jsonb;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_validapay_price
  ON public.subscription_plans (validapay_price_id)
  WHERE validapay_price_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_validapay_checkout
  ON public.student_subscriptions (validapay_checkout_session_id)
  WHERE validapay_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_validapay_charge
  ON public.student_subscriptions (validapay_charge_id)
  WHERE validapay_charge_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_validapay_payment
  ON public.student_subscriptions (validapay_payment_id)
  WHERE validapay_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_validapay_subscription
  ON public.student_subscriptions (validapay_subscription_id)
  WHERE validapay_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.validapay_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text,
  event_type text NOT NULL,
  provider_reference text,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_validapay_webhook_events_event_id
  ON public.validapay_webhook_events (event_id);

CREATE INDEX IF NOT EXISTS idx_validapay_webhook_events_created
  ON public.validapay_webhook_events (created_at DESC);

ALTER TABLE public.validapay_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devs view validapay webhook events" ON public.validapay_webhook_events;
CREATE POLICY "Devs view validapay webhook events"
ON public.validapay_webhook_events
FOR SELECT TO authenticated
USING (public.has_role((select auth.uid()), 'dev'));

REVOKE ALL ON public.validapay_webhook_events FROM anon, authenticated;
GRANT SELECT ON public.validapay_webhook_events TO authenticated;
