ALTER TABLE public.student_subscriptions
  ADD COLUMN IF NOT EXISTS asaas_customer_id text,
  ADD COLUMN IF NOT EXISTS asaas_pix_authorization_id text,
  ADD COLUMN IF NOT EXISTS asaas_pix_authorization_status text,
  ADD COLUMN IF NOT EXISTS asaas_pix_contract_id text,
  ADD COLUMN IF NOT EXISTS asaas_pix_conciliation_id text,
  ADD COLUMN IF NOT EXISTS asaas_payment_id text,
  ADD COLUMN IF NOT EXISTS asaas_payment_status text,
  ADD COLUMN IF NOT EXISTS asaas_pix_payload text,
  ADD COLUMN IF NOT EXISTS asaas_pix_encoded_image text,
  ADD COLUMN IF NOT EXISTS asaas_pix_expiration_date timestamptz;

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_asaas_authorization
  ON public.student_subscriptions (asaas_pix_authorization_id)
  WHERE asaas_pix_authorization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_asaas_contract
  ON public.student_subscriptions (asaas_pix_contract_id)
  WHERE asaas_pix_contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_asaas_payment
  ON public.student_subscriptions (asaas_payment_id)
  WHERE asaas_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_asaas_conciliation
  ON public.student_subscriptions (asaas_pix_conciliation_id)
  WHERE asaas_pix_conciliation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.asaas_subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.student_subscriptions(id) ON DELETE CASCADE,
  asaas_payment_id text NOT NULL UNIQUE,
  payment_reference text NOT NULL UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  due_date date NOT NULL,
  invoice_url text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_asaas_subscription_payments_period
  ON public.asaas_subscription_payments (subscription_id, period_start);

ALTER TABLE public.asaas_subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devs view asaas subscription payments" ON public.asaas_subscription_payments;
CREATE POLICY "Devs view asaas subscription payments"
ON public.asaas_subscription_payments
FOR SELECT TO authenticated
USING (public.has_role((select auth.uid()), 'dev'));

REVOKE ALL ON public.asaas_subscription_payments FROM anon, authenticated;
GRANT SELECT ON public.asaas_subscription_payments TO authenticated;

DROP TRIGGER IF EXISTS asaas_subscription_payments_updated ON public.asaas_subscription_payments;
CREATE TRIGGER asaas_subscription_payments_updated
BEFORE UPDATE ON public.asaas_subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.teacher_withdrawal_requests
  ADD COLUMN IF NOT EXISTS payout_provider text,
  ADD COLUMN IF NOT EXISTS payout_external_id text,
  ADD COLUMN IF NOT EXISTS payout_external_status text,
  ADD COLUMN IF NOT EXISTS payout_response jsonb,
  ADD COLUMN IF NOT EXISTS payout_error text,
  ADD COLUMN IF NOT EXISTS payout_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS payout_receipt_url text;

CREATE INDEX IF NOT EXISTS idx_teacher_withdrawals_payout_external
  ON public.teacher_withdrawal_requests (payout_provider, payout_external_id)
  WHERE payout_external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.platform_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  pix_key_type public.pix_key_type NOT NULL,
  pix_key text NOT NULL CHECK (length(trim(pix_key)) BETWEEN 3 AND 200),
  account_holder_name text NOT NULL CHECK (length(trim(account_holder_name)) BETWEEN 2 AND 160),
  status public.teacher_withdrawal_status NOT NULL DEFAULT 'pendente',
  wallet_transaction_id uuid REFERENCES public.platform_wallet_transactions(id) ON DELETE SET NULL,
  payout_provider text,
  payout_external_id text,
  payout_external_status text,
  payout_response jsonb,
  payout_error text,
  payout_requested_at timestamptz,
  payout_receipt_url text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_withdrawals_created
  ON public.platform_withdrawal_requests (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_withdrawals_external
  ON public.platform_withdrawal_requests (payout_provider, payout_external_id)
  WHERE payout_external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.asaas_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  event_type text,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.asaas_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devs view asaas webhook events" ON public.asaas_webhook_events;
CREATE POLICY "Devs view asaas webhook events"
ON public.asaas_webhook_events
FOR SELECT TO authenticated
USING (public.has_role((select auth.uid()), 'dev'));

REVOKE ALL ON public.asaas_webhook_events FROM anon, authenticated;
GRANT SELECT ON public.asaas_webhook_events TO authenticated;

ALTER TABLE public.platform_withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS platform_withdrawals_updated ON public.platform_withdrawal_requests;
CREATE TRIGGER platform_withdrawals_updated
BEFORE UPDATE ON public.platform_withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "Devs manage platform withdrawals" ON public.platform_withdrawal_requests;
CREATE POLICY "Devs manage platform withdrawals"
ON public.platform_withdrawal_requests
FOR ALL TO authenticated
USING (public.has_role((select auth.uid()), 'dev'))
WITH CHECK (public.has_role((select auth.uid()), 'dev'));

REVOKE ALL ON public.platform_withdrawal_requests FROM anon;
GRANT SELECT ON public.platform_withdrawal_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.create_teacher_withdrawal_request(
  _teacher_id uuid,
  _amount numeric,
  _pix_key_type public.pix_key_type,
  _pix_key text,
  _account_holder_name text,
  _account_holder_document text DEFAULT NULL,
  _teacher_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _available numeric(12,2);
  _withdrawal_id uuid;
  _normalized_amount numeric(12,2) := round(coalesce(_amount, 0), 2);
BEGIN
  IF _teacher_id IS NULL THEN
    RAISE EXCEPTION 'teacher id required' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = _teacher_id) THEN
    RAISE EXCEPTION 'teacher profile required' USING ERRCODE = '42501';
  END IF;

  IF _normalized_amount <= 0 THEN
    RAISE EXCEPTION 'withdrawal amount must be greater than zero' USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(_pix_key, ''))) < 3 THEN
    RAISE EXCEPTION 'pix key is required' USING ERRCODE = '22023';
  END IF;

  IF length(trim(coalesce(_account_holder_name, ''))) < 2 THEN
    RAISE EXCEPTION 'account holder name is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(_teacher_id::text));
  _available := public.teacher_wallet_available_balance(_teacher_id);

  IF _available < _normalized_amount THEN
    RAISE EXCEPTION 'insufficient wallet balance' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.teacher_withdrawal_requests (
    teacher_id,
    amount,
    pix_key_type,
    pix_key,
    account_holder_name,
    account_holder_document,
    teacher_notes,
    status
  )
  VALUES (
    _teacher_id,
    _normalized_amount,
    _pix_key_type,
    trim(_pix_key),
    trim(_account_holder_name),
    NULLIF(regexp_replace(coalesce(_account_holder_document, ''), '\D', '', 'g'), ''),
    NULLIF(trim(coalesce(_teacher_notes, '')), ''),
    'pendente'
  )
  RETURNING id INTO _withdrawal_id;

  INSERT INTO public.teacher_wallet_transactions (
    teacher_id,
    withdrawal_request_id,
    transaction_type,
    amount,
    description,
    created_by
  )
  VALUES (
    _teacher_id,
    _withdrawal_id,
    'withdrawal_hold',
    -_normalized_amount,
    'Saque Pix solicitado pelo professor',
    _teacher_id
  );

  RETURN _withdrawal_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_teacher_withdrawal_request(
  uuid,
  numeric,
  public.pix_key_type,
  text,
  text,
  text,
  text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_teacher_withdrawal_request(
  uuid,
  numeric,
  public.pix_key_type,
  text,
  text,
  text,
  text
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.request_teacher_withdrawal(
  numeric,
  public.pix_key_type,
  text,
  text,
  text,
  text
) FROM authenticated;
