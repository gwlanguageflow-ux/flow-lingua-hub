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

  IF NOT FOUND THEN
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
