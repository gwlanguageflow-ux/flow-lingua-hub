ALTER TABLE public.student_subscriptions
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.teacher_profiles(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_subs_student_teacher_status
  ON public.student_subscriptions(student_id, teacher_id, status);

ALTER TABLE public.teacher_wallet_transactions
  ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.student_subscriptions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teacher_wallet_subscription_credit_once
  ON public.teacher_wallet_transactions (subscription_id)
  WHERE subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.platform_wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.student_subscriptions(id) ON DELETE SET NULL,
  teacher_id uuid REFERENCES public.teacher_profiles(id) ON DELETE SET NULL,
  student_id uuid REFERENCES public.student_profiles(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('subscription_fee','manual_adjustment')),
  amount numeric(12,2) NOT NULL CHECK (amount <> 0),
  gross_amount numeric(12,2),
  fee_rate numeric(5,4) NOT NULL DEFAULT 0.1000,
  description text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_wallet_subscription_fee_once
  ON public.platform_wallet_transactions (subscription_id)
  WHERE transaction_type = 'subscription_fee' AND subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_wallet_created
  ON public.platform_wallet_transactions(created_at DESC);

ALTER TABLE public.platform_wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Devs view platform wallet transactions" ON public.platform_wallet_transactions;
CREATE POLICY "Devs view platform wallet transactions"
ON public.platform_wallet_transactions
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Devs manage platform wallet transactions" ON public.platform_wallet_transactions;
CREATE POLICY "Devs manage platform wallet transactions"
ON public.platform_wallet_transactions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'dev'))
WITH CHECK (public.has_role(auth.uid(), 'dev'));

REVOKE ALL ON public.platform_wallet_transactions FROM anon;
GRANT SELECT ON public.platform_wallet_transactions TO authenticated;

CREATE OR REPLACE FUNCTION public.student_can_book_with_teacher(_student_id uuid, _teacher_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_student_id = auth.uid() OR public.has_role(auth.uid(), 'dev'), false)
    AND EXISTS (
    SELECT 1
    FROM public.student_subscriptions
    WHERE student_id = _student_id
      AND teacher_id = _teacher_id
      AND status = 'ativa'
      AND (current_period_end IS NULL OR current_period_end > now())
  )
$$;

REVOKE EXECUTE ON FUNCTION public.student_can_book_with_teacher(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_can_book_with_teacher(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.activate_paid_student_subscription(
  _subscription_id uuid,
  _stripe_subscription_id text DEFAULT NULL,
  _period_start timestamptz DEFAULT now(),
  _period_end timestamptz DEFAULT NULL
)
RETURNS TABLE (
  teacher_transaction_id uuid,
  platform_transaction_id uuid,
  teacher_amount numeric,
  platform_amount numeric,
  gross_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _sub public.student_subscriptions%ROWTYPE;
  _plan public.subscription_plans%ROWTYPE;
  _teacher public.teacher_profiles%ROWTYPE;
  _student public.student_profiles%ROWTYPE;
  _gross numeric(12,2);
  _teacher_amount numeric(12,2);
  _platform_amount numeric(12,2);
  _teacher_transaction_id uuid;
  _platform_transaction_id uuid;
  _class_id uuid;
  _class_language text;
BEGIN
  SELECT *
  INTO _sub
  FROM public.student_subscriptions
  WHERE id = _subscription_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription not found' USING ERRCODE = 'P0002';
  END IF;

  IF _sub.teacher_id IS NULL THEN
    RAISE EXCEPTION 'subscription has no teacher' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _plan
  FROM public.subscription_plans
  WHERE id = _sub.plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription plan not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO _teacher
  FROM public.teacher_profiles
  WHERE id = _sub.teacher_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'teacher is not active' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO _student
  FROM public.student_profiles
  WHERE id = _sub.student_id;

  _gross := round(_plan.price, 2);
  _teacher_amount := round((_gross * 0.90), 2);
  _platform_amount := (_gross - _teacher_amount)::numeric(12,2);

  UPDATE public.student_subscriptions
  SET status = 'ativa',
      stripe_subscription_id = coalesce(_stripe_subscription_id, stripe_subscription_id),
      current_period_start = coalesce(_period_start, current_period_start, now()),
      current_period_end = coalesce(_period_end, current_period_end),
      last_payment_at = now(),
      updated_at = now()
  WHERE id = _subscription_id;

  INSERT INTO public.teacher_wallet_transactions (
    teacher_id,
    subscription_id,
    transaction_type,
    amount,
    gross_amount,
    platform_fee,
    platform_fee_rate,
    description,
    created_by
  )
  VALUES (
    _sub.teacher_id,
    _sub.id,
    'manual_adjustment',
    _teacher_amount,
    _gross,
    _platform_amount,
    0.1000,
    'Credito de assinatura ativada',
    _sub.student_id
  )
  ON CONFLICT (subscription_id) WHERE subscription_id IS NOT NULL
  DO UPDATE SET subscription_id = excluded.subscription_id
  RETURNING id INTO _teacher_transaction_id;

  INSERT INTO public.platform_wallet_transactions (
    subscription_id,
    teacher_id,
    student_id,
    transaction_type,
    amount,
    gross_amount,
    fee_rate,
    description,
    created_by
  )
  VALUES (
    _sub.id,
    _sub.teacher_id,
    _sub.student_id,
    'subscription_fee',
    _platform_amount,
    _gross,
    0.1000,
    'Taxa da plataforma sobre assinatura ativada',
    _sub.student_id
  )
  ON CONFLICT (subscription_id) WHERE transaction_type = 'subscription_fee' AND subscription_id IS NOT NULL
  DO UPDATE SET subscription_id = excluded.subscription_id
  RETURNING id INTO _platform_transaction_id;

  SELECT id INTO _class_id
  FROM public.class_groups
  WHERE teacher_id = _sub.teacher_id
    AND status = 'ativa'
  ORDER BY created_at ASC
  LIMIT 1;

  IF _class_id IS NULL THEN
    _class_language := coalesce(_teacher.languages_taught[1], _student.desired_language, 'Idioma');

    INSERT INTO public.class_groups (
      teacher_id,
      name,
      language,
      level,
      description
    )
    VALUES (
      _sub.teacher_id,
      'Alunos assinantes',
      _class_language,
      _student.comprehension_level,
      'Turma padrao para alunos com assinatura ativa.'
    )
    RETURNING id INTO _class_id;
  END IF;

  INSERT INTO public.class_members (class_id, student_id, status)
  VALUES (_class_id, _sub.student_id, 'ativo')
  ON CONFLICT (class_id, student_id)
  DO UPDATE SET status = 'ativo', joined_at = now();

  RETURN QUERY
  SELECT _teacher_transaction_id, _platform_transaction_id, _teacher_amount, _platform_amount, _gross;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_paid_student_subscription(uuid, text, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_paid_student_subscription(uuid, text, timestamptz, timestamptz)
  TO service_role;

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
    coalesce(sum(t.amount) FILTER (WHERE t.amount > 0), 0)::numeric(12,2) AS total_received,
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

DROP POLICY IF EXISTS "Student creates booking" ON public.bookings;
CREATE POLICY "Student creates booking" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND public.student_can_book_with_teacher(auth.uid(), teacher_id)
  );

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
    AND ss.teacher_id = _booking.teacher_id
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student has no active subscription for this teacher' USING ERRCODE = '22023';
  END IF;

  SELECT t.id INTO _transaction_id
  FROM public.teacher_wallet_transactions t
  WHERE t.subscription_id = _sub.id
    AND t.transaction_type = 'manual_adjustment';

  IF _transaction_id IS NOT NULL THEN
    UPDATE public.bookings
    SET status = 'concluido',
        updated_at = now()
    WHERE id = _booking_id;

    RETURN QUERY
    SELECT
      t.id,
      0::numeric(12,2),
      0::numeric(12,2),
      0::numeric(12,2)
    FROM public.teacher_wallet_transactions t
    WHERE t.id = _transaction_id;
    RETURN;
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
