-- Teacher wallet MVP.
-- Money movement is represented as an append-only ledger. Lesson credits use the
-- 90% teacher / 10% platform split requested for GWLanguageFlow.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'teacher_wallet_transaction_type') THEN
    CREATE TYPE public.teacher_wallet_transaction_type AS ENUM (
      'lesson_credit',
      'withdrawal_hold',
      'withdrawal_reversal',
      'manual_adjustment'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'teacher_withdrawal_status') THEN
    CREATE TYPE public.teacher_withdrawal_status AS ENUM (
      'pendente',
      'em_processamento',
      'pago',
      'falhou',
      'cancelado'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pix_key_type') THEN
    CREATE TYPE public.pix_key_type AS ENUM ('cpf', 'email', 'telefone', 'aleatoria');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.teacher_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  pix_key_type public.pix_key_type NOT NULL,
  pix_key text NOT NULL CHECK (length(trim(pix_key)) BETWEEN 3 AND 140),
  account_holder_name text NOT NULL CHECK (length(trim(account_holder_name)) BETWEEN 2 AND 140),
  account_holder_document text,
  status public.teacher_withdrawal_status NOT NULL DEFAULT 'pendente',
  teacher_notes text,
  admin_notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  withdrawal_request_id uuid REFERENCES public.teacher_withdrawal_requests(id) ON DELETE SET NULL,
  transaction_type public.teacher_wallet_transaction_type NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount <> 0),
  gross_amount numeric(12,2),
  platform_fee numeric(12,2),
  platform_fee_rate numeric(5,4) NOT NULL DEFAULT 0.1000,
  description text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_wallet_lesson_credit_amount
    CHECK (transaction_type <> 'lesson_credit' OR amount > 0),
  CONSTRAINT teacher_wallet_withdrawal_hold_amount
    CHECK (transaction_type <> 'withdrawal_hold' OR amount < 0),
  CONSTRAINT teacher_wallet_withdrawal_reversal_amount
    CHECK (transaction_type <> 'withdrawal_reversal' OR amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_wallet_lesson_credit_once
  ON public.teacher_wallet_transactions (booking_id)
  WHERE transaction_type = 'lesson_credit' AND booking_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_wallet_withdrawal_hold_once
  ON public.teacher_wallet_transactions (withdrawal_request_id)
  WHERE transaction_type = 'withdrawal_hold' AND withdrawal_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_teacher_wallet_transactions_teacher_created
  ON public.teacher_wallet_transactions (teacher_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_teacher_withdrawals_teacher_created
  ON public.teacher_withdrawal_requests (teacher_id, created_at DESC);

ALTER TABLE public.teacher_wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers view own wallet transactions" ON public.teacher_wallet_transactions;
CREATE POLICY "Teachers view own wallet transactions"
ON public.teacher_wallet_transactions
FOR SELECT TO authenticated
USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Devs manage wallet transactions" ON public.teacher_wallet_transactions;
CREATE POLICY "Devs manage wallet transactions"
ON public.teacher_wallet_transactions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'dev'))
WITH CHECK (public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Teachers view own withdrawals" ON public.teacher_withdrawal_requests;
CREATE POLICY "Teachers view own withdrawals"
ON public.teacher_withdrawal_requests
FOR SELECT TO authenticated
USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Devs manage withdrawals" ON public.teacher_withdrawal_requests;
CREATE POLICY "Devs manage withdrawals"
ON public.teacher_withdrawal_requests
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'dev'))
WITH CHECK (public.has_role(auth.uid(), 'dev'));

REVOKE INSERT, UPDATE, DELETE ON public.teacher_wallet_transactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.teacher_withdrawal_requests FROM anon, authenticated;
GRANT SELECT ON public.teacher_wallet_transactions TO authenticated;
GRANT SELECT ON public.teacher_withdrawal_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.teacher_wallet_available_balance(_teacher_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(sum(amount), 0)::numeric(12,2)
  FROM public.teacher_wallet_transactions
  WHERE teacher_id = _teacher_id
$$;

REVOKE EXECUTE ON FUNCTION public.teacher_wallet_available_balance(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.teacher_wallet_available_balance(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_teacher_wallet_summary()
RETURNS TABLE (
  available_balance numeric,
  total_received numeric,
  total_withdrawn numeric,
  pending_withdrawals numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    coalesce(sum(t.amount), 0)::numeric(12,2) AS available_balance,
    coalesce(sum(t.amount) FILTER (WHERE t.transaction_type = 'lesson_credit'), 0)::numeric(12,2) AS total_received,
    coalesce(sum(abs(t.amount)) FILTER (
      WHERE t.transaction_type = 'withdrawal_hold'
        AND w.status = 'pago'
    ), 0)::numeric(12,2) AS total_withdrawn,
    coalesce(sum(abs(t.amount)) FILTER (
      WHERE t.transaction_type = 'withdrawal_hold'
        AND w.status IN ('pendente', 'em_processamento')
    ), 0)::numeric(12,2) AS pending_withdrawals
  FROM public.teacher_wallet_transactions t
  LEFT JOIN public.teacher_withdrawal_requests w ON w.id = t.withdrawal_request_id
  WHERE t.teacher_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_teacher_wallet_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_wallet_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.credit_teacher_for_completed_booking(_booking_id uuid)
RETURNS TABLE (
  transaction_id uuid,
  teacher_amount numeric,
  platform_amount numeric,
  gross_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _booking public.bookings%ROWTYPE;
  _user_id uuid := auth.uid();
  _sub record;
  _period_hours numeric;
  _gross numeric(12,2);
  _teacher_amount numeric(12,2);
  _platform_amount numeric(12,2);
  _transaction_id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _booking
  FROM public.bookings
  WHERE id = _booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking not found' USING ERRCODE = 'P0002';
  END IF;

  IF _booking.teacher_id <> _user_id AND NOT public.has_role(_user_id, 'dev') THEN
    RAISE EXCEPTION 'only the teacher can complete this booking' USING ERRCODE = '42501';
  END IF;

  IF _booking.status = 'cancelado' THEN
    RAISE EXCEPTION 'cancelled bookings cannot be credited' USING ERRCODE = '22023';
  END IF;

  IF _booking.scheduled_at > now() + interval '10 minutes' THEN
    RAISE EXCEPTION 'future bookings cannot be completed yet' USING ERRCODE = '22023';
  END IF;

  SELECT t.id INTO _transaction_id
  FROM public.teacher_wallet_transactions t
  WHERE t.booking_id = _booking_id
    AND t.transaction_type = 'lesson_credit';

  IF _transaction_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      t.id,
      t.amount,
      coalesce(t.platform_fee, 0)::numeric(12,2),
      coalesce(t.gross_amount, t.amount)::numeric(12,2)
    FROM public.teacher_wallet_transactions t
    WHERE t.id = _transaction_id;
    RETURN;
  END IF;

  SELECT ss.id, sp.price, sp.interval, sp.hours_per_week
  INTO _sub
  FROM public.student_subscriptions ss
  JOIN public.subscription_plans sp ON sp.id = ss.plan_id
  WHERE ss.student_id = _booking.student_id
    AND ss.status = 'ativa'
    AND (
      ss.current_period_start IS NULL
      OR ss.current_period_start <= _booking.scheduled_at
    )
    AND (
      ss.current_period_end IS NULL
      OR ss.current_period_end >= _booking.scheduled_at
    )
  ORDER BY ss.created_at DESC
  LIMIT 1;

  IF _sub.id IS NULL THEN
    RAISE EXCEPTION 'student has no active subscription for this booking' USING ERRCODE = '22023';
  END IF;

  _period_hours :=
    CASE _sub.interval
      WHEN 'mensal' THEN coalesce(_sub.hours_per_week, 1) * 4
      WHEN 'trimestral' THEN coalesce(_sub.hours_per_week, 1) * 12
      WHEN 'anual' THEN coalesce(_sub.hours_per_week, 1) * 52
      ELSE coalesce(_sub.hours_per_week, 1) * 4
    END;

  IF _period_hours <= 0 THEN
    RAISE EXCEPTION 'invalid plan hours' USING ERRCODE = '22023';
  END IF;

  _gross := round(((_sub.price / _period_hours) * (_booking.duration_minutes::numeric / 60)), 2);
  _teacher_amount := round((_gross * 0.90), 2);
  _platform_amount := (_gross - _teacher_amount)::numeric(12,2);

  UPDATE public.bookings
  SET status = 'concluido',
      updated_at = now()
  WHERE id = _booking_id;

  INSERT INTO public.teacher_wallet_transactions (
    teacher_id,
    booking_id,
    transaction_type,
    amount,
    gross_amount,
    platform_fee,
    platform_fee_rate,
    description,
    created_by
  )
  VALUES (
    _booking.teacher_id,
    _booking.id,
    'lesson_credit',
    _teacher_amount,
    _gross,
    _platform_amount,
    0.1000,
    'Credito de aula concluida',
    _user_id
  )
  RETURNING id INTO _transaction_id;

  RETURN QUERY SELECT _transaction_id, _teacher_amount, _platform_amount, _gross;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.credit_teacher_for_completed_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.credit_teacher_for_completed_booking(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_teacher_withdrawal(
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
  _teacher_id uuid := auth.uid();
  _available numeric(12,2);
  _withdrawal_id uuid;
  _normalized_amount numeric(12,2) := round(coalesce(_amount, 0), 2);
BEGIN
  IF _teacher_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.teacher_profiles WHERE id = _teacher_id) THEN
    RAISE EXCEPTION 'teacher profile required' USING ERRCODE = '42501';
  END IF;

  IF _normalized_amount < 10 THEN
    RAISE EXCEPTION 'minimum withdrawal is R$ 10,00' USING ERRCODE = '22023';
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
    teacher_notes
  )
  VALUES (
    _teacher_id,
    _normalized_amount,
    _pix_key_type,
    trim(_pix_key),
    trim(_account_holder_name),
    NULLIF(regexp_replace(coalesce(_account_holder_document, ''), '\D', '', 'g'), ''),
    NULLIF(trim(coalesce(_teacher_notes, '')), '')
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
    'Solicitacao de saque via Pix',
    _teacher_id
  );

  RETURN _withdrawal_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_teacher_withdrawal(
  numeric,
  public.pix_key_type,
  text,
  text,
  text,
  text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_teacher_withdrawal(
  numeric,
  public.pix_key_type,
  text,
  text,
  text,
  text
) TO authenticated;

CREATE TRIGGER teacher_withdrawals_updated
BEFORE UPDATE ON public.teacher_withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
