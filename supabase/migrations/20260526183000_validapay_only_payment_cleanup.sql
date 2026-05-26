DROP FUNCTION IF EXISTS public.activate_paid_student_subscription(uuid, text, timestamptz, timestamptz, text);
DROP FUNCTION IF EXISTS public.activate_paid_student_subscription(uuid, text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.activate_paid_student_subscription(uuid, timestamptz, timestamptz, text);

DROP INDEX IF EXISTS public.idx_student_subscriptions_asaas_authorization;
DROP INDEX IF EXISTS public.idx_student_subscriptions_asaas_contract;
DROP INDEX IF EXISTS public.idx_student_subscriptions_asaas_payment;
DROP INDEX IF EXISTS public.idx_student_subscriptions_asaas_conciliation;

DROP TABLE IF EXISTS public.asaas_subscription_payments CASCADE;
DROP TABLE IF EXISTS public.asaas_webhook_events CASCADE;

ALTER TABLE public.subscription_plans
  DROP COLUMN IF EXISTS stripe_price_id_card;

ALTER TABLE public.student_subscriptions
  DROP COLUMN IF EXISTS stripe_checkout_session_id,
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS asaas_customer_id,
  DROP COLUMN IF EXISTS asaas_payment_id,
  DROP COLUMN IF EXISTS asaas_payment_status,
  DROP COLUMN IF EXISTS asaas_pix_authorization_id,
  DROP COLUMN IF EXISTS asaas_pix_authorization_status,
  DROP COLUMN IF EXISTS asaas_pix_conciliation_id,
  DROP COLUMN IF EXISTS asaas_pix_contract_id,
  DROP COLUMN IF EXISTS asaas_pix_encoded_image,
  DROP COLUMN IF EXISTS asaas_pix_expiration_date,
  DROP COLUMN IF EXISTS asaas_pix_payload;

CREATE OR REPLACE FUNCTION public.activate_paid_student_subscription(
  _subscription_id uuid,
  _period_start timestamptz DEFAULT now(),
  _period_end timestamptz DEFAULT NULL,
  _payment_reference text DEFAULT NULL
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
  _reference text := nullif(trim(coalesce(_payment_reference, '')), '');
  _resolved_period_start timestamptz := coalesce(_period_start, now());
  _resolved_period_end timestamptz;
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

  SELECT *
  INTO _plan
  FROM public.subscription_plans
  WHERE id = _sub.plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'subscription plan not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO _teacher
  FROM public.teacher_profiles
  WHERE id = _sub.teacher_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'teacher is not active' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO _student
  FROM public.student_profiles
  WHERE id = _sub.student_id;

  _resolved_period_end := coalesce(
    _period_end,
    CASE _plan.interval
      WHEN 'trimestral' THEN _resolved_period_start + interval '3 months'
      WHEN 'anual' THEN _resolved_period_start + interval '1 year'
      ELSE _resolved_period_start + interval '1 month'
    END
  );

  _reference := coalesce(_reference, _subscription_id::text);
  _gross := round(_plan.price, 2);
  _teacher_amount := round((_gross * 0.90), 2);
  _platform_amount := (_gross - _teacher_amount)::numeric(12,2);

  UPDATE public.student_subscriptions
  SET status = 'ativa',
      current_period_start = _resolved_period_start,
      current_period_end = _resolved_period_end,
      last_payment_at = now(),
      updated_at = now()
  WHERE id = _subscription_id;

  INSERT INTO public.teacher_wallet_transactions (
    teacher_id,
    subscription_id,
    subscription_payment_reference,
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
    _reference,
    'manual_adjustment',
    _teacher_amount,
    _gross,
    _platform_amount,
    0.1000,
    'Credito de assinatura paga via ValidaPay',
    _sub.student_id
  )
  ON CONFLICT (subscription_id, subscription_payment_reference)
  WHERE transaction_type = 'manual_adjustment'
    AND subscription_id IS NOT NULL
    AND subscription_payment_reference IS NOT NULL
  DO UPDATE SET subscription_payment_reference = excluded.subscription_payment_reference
  RETURNING id INTO _teacher_transaction_id;

  INSERT INTO public.platform_wallet_transactions (
    subscription_id,
    subscription_payment_reference,
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
    _reference,
    _sub.teacher_id,
    _sub.student_id,
    'subscription_fee',
    _platform_amount,
    _gross,
    0.1000,
    'Taxa da plataforma sobre assinatura paga via ValidaPay',
    _sub.student_id
  )
  ON CONFLICT (subscription_id, subscription_payment_reference)
  WHERE transaction_type = 'subscription_fee'
    AND subscription_id IS NOT NULL
    AND subscription_payment_reference IS NOT NULL
  DO UPDATE SET subscription_payment_reference = excluded.subscription_payment_reference
  RETURNING id INTO _platform_transaction_id;

  SELECT id
  INTO _class_id
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

REVOKE EXECUTE ON FUNCTION public.activate_paid_student_subscription(uuid, timestamptz, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_paid_student_subscription(uuid, timestamptz, timestamptz, text)
  TO service_role;
