-- Live delivery fixes and custom teacher plans.

CREATE TABLE IF NOT EXISTS public.teacher_custom_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 3 AND 80),
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 500),
  price numeric(10,2) NOT NULL CHECK (price > 0),
  interval public.plan_interval NOT NULL DEFAULT 'mensal',
  sort_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  validapay_product_id text,
  validapay_price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_teacher_custom_plans_teacher_active
  ON public.teacher_custom_plans (teacher_id, is_active, sort_order);

ALTER TABLE public.teacher_custom_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Custom teacher plans public read active" ON public.teacher_custom_plans;
CREATE POLICY "Custom teacher plans public read active"
ON public.teacher_custom_plans
FOR SELECT
TO anon, authenticated
USING (
  is_active = true
  OR teacher_id = auth.uid()
  OR public.has_role(auth.uid(), 'dev'::public.app_role)
);

DROP POLICY IF EXISTS "Teachers manage own custom plans" ON public.teacher_custom_plans;
CREATE POLICY "Teachers manage own custom plans"
ON public.teacher_custom_plans
FOR ALL
TO authenticated
USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'::public.app_role))
WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'::public.app_role));

DROP TRIGGER IF EXISTS teacher_custom_plans_updated ON public.teacher_custom_plans;
CREATE TRIGGER teacher_custom_plans_updated
  BEFORE UPDATE ON public.teacher_custom_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.teacher_custom_plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teacher_custom_plans TO authenticated;

CREATE TABLE IF NOT EXISTS public.discounted_teacher_plan_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_plan_id uuid NOT NULL REFERENCES public.teacher_custom_plans(id) ON DELETE CASCADE,
  discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 1 AND 80),
  final_amount numeric(10,2) NOT NULL CHECK (final_amount >= 0),
  validapay_product_id text,
  validapay_price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (custom_plan_id, discount_percent)
);

CREATE INDEX IF NOT EXISTS idx_discounted_teacher_plan_prices_plan
  ON public.discounted_teacher_plan_prices (custom_plan_id, discount_percent);

ALTER TABLE public.discounted_teacher_plan_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors manage discounted teacher plan prices" ON public.discounted_teacher_plan_prices;
CREATE POLICY "Directors manage discounted teacher plan prices"
ON public.discounted_teacher_plan_prices
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'dev'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'dev'::public.app_role));

DROP TRIGGER IF EXISTS discounted_teacher_plan_prices_updated ON public.discounted_teacher_plan_prices;
CREATE TRIGGER discounted_teacher_plan_prices_updated
  BEFORE UPDATE ON public.discounted_teacher_plan_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.discounted_teacher_plan_prices TO authenticated;

ALTER TABLE public.student_subscriptions
  ADD COLUMN IF NOT EXISTS custom_plan_id uuid REFERENCES public.teacher_custom_plans(id) ON DELETE SET NULL;

ALTER TABLE public.student_subscriptions
  ALTER COLUMN plan_id DROP NOT NULL;

ALTER TABLE public.student_subscriptions
  DROP CONSTRAINT IF EXISTS student_subscriptions_plan_or_custom_check;

ALTER TABLE public.student_subscriptions
  ADD CONSTRAINT student_subscriptions_plan_or_custom_check
  CHECK (num_nonnulls(plan_id, custom_plan_id) = 1);

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_custom_plan
  ON public.student_subscriptions (custom_plan_id)
  WHERE custom_plan_id IS NOT NULL;

ALTER TABLE public.coupon_redemptions
  ADD COLUMN IF NOT EXISTS custom_plan_id uuid REFERENCES public.teacher_custom_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_custom_plan
  ON public.coupon_redemptions (custom_plan_id)
  WHERE custom_plan_id IS NOT NULL;

ALTER TABLE public.class_assignments
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.student_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.class_assignments
  ALTER COLUMN class_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_class_assignments_student_due
  ON public.class_assignments (student_id, due_at);

DROP POLICY IF EXISTS "Class materials visible to owners and students" ON public.class_materials;
CREATE POLICY "Class materials visible to owners and students"
ON public.class_materials
FOR SELECT
TO authenticated
USING (
  source = 'platform'
  OR teacher_id = auth.uid()
  OR student_id = auth.uid()
  OR public.has_role(auth.uid(), 'dev'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.class_members cm
    WHERE cm.class_id = class_materials.class_id
      AND cm.student_id = auth.uid()
      AND cm.status = 'ativo'
  )
);

DROP POLICY IF EXISTS "Teachers manage own class materials" ON public.class_materials;
CREATE POLICY "Teachers manage own class materials"
ON public.class_materials
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'dev'::public.app_role)
  OR teacher_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'dev'::public.app_role)
  OR (
    teacher_id = auth.uid()
    AND (
      class_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.class_groups cg
        WHERE cg.id = class_materials.class_id
          AND cg.teacher_id = auth.uid()
      )
    )
    AND (
      student_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.teacher_id = auth.uid()
          AND b.student_id = class_materials.student_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.class_members cm
        JOIN public.class_groups cg ON cg.id = cm.class_id
        WHERE cg.teacher_id = auth.uid()
          AND cm.student_id = class_materials.student_id
          AND cm.status = 'ativo'
      )
    )
  )
);

DROP POLICY IF EXISTS "Assignments visible to class participants" ON public.class_assignments;
CREATE POLICY "Assignments visible to class participants"
ON public.class_assignments
FOR SELECT
TO authenticated
USING (
  teacher_id = auth.uid()
  OR student_id = auth.uid()
  OR public.has_role(auth.uid(), 'dev'::public.app_role)
  OR EXISTS (
    SELECT 1
    FROM public.class_members cm
    WHERE cm.class_id = class_assignments.class_id
      AND cm.student_id = auth.uid()
      AND cm.status = 'ativo'
  )
);

DROP POLICY IF EXISTS "Teachers manage own assignments" ON public.class_assignments;
CREATE POLICY "Teachers manage own assignments"
ON public.class_assignments
FOR ALL
TO authenticated
USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'::public.app_role))
WITH CHECK (
  public.has_role(auth.uid(), 'dev'::public.app_role)
  OR (
    teacher_id = auth.uid()
    AND (
      class_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.class_groups cg
        WHERE cg.id = class_assignments.class_id
          AND cg.teacher_id = auth.uid()
      )
    )
    AND (
      student_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.teacher_id = auth.uid()
          AND b.student_id = class_assignments.student_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.class_members cm
        JOIN public.class_groups cg ON cg.id = cm.class_id
        WHERE cg.teacher_id = auth.uid()
          AND cm.student_id = class_assignments.student_id
          AND cm.status = 'ativo'
      )
    )
  )
);

DROP POLICY IF EXISTS "Learning materials readable by linked users" ON storage.objects;
CREATE POLICY "Learning materials readable by linked users"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'learning-materials'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'dev'::public.app_role)
    OR EXISTS (
      SELECT 1
      FROM public.class_materials m
      WHERE m.file_path = storage.objects.name
        AND (
          m.source = 'platform'
          OR m.teacher_id = auth.uid()
          OR m.student_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.class_members cm
            WHERE cm.class_id = m.class_id
              AND cm.student_id = auth.uid()
              AND cm.status = 'ativo'
          )
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.class_assignments a
      WHERE a.file_path = storage.objects.name
        AND (
          a.teacher_id = auth.uid()
          OR a.student_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.class_members cm
            WHERE cm.class_id = a.class_id
              AND cm.student_id = auth.uid()
              AND cm.status = 'ativo'
          )
        )
    )
  )
);

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
  _custom_plan public.teacher_custom_plans%ROWTYPE;
  _teacher public.teacher_profiles%ROWTYPE;
  _student public.student_profiles%ROWTYPE;
  _gross numeric(12,2);
  _teacher_amount numeric(12,2);
  _platform_amount numeric(12,2);
  _teacher_transaction_id uuid;
  _platform_transaction_id uuid;
  _class_id uuid;
  _class_language text;
  _plan_interval public.plan_interval := 'mensal';
  _coupon_final_amount numeric(12,2);
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

  IF _sub.plan_id IS NOT NULL THEN
    SELECT *
    INTO _plan
    FROM public.subscription_plans
    WHERE id = _sub.plan_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'subscription plan not found' USING ERRCODE = 'P0002';
    END IF;

    _gross := round(_plan.price, 2);
    _plan_interval := _plan.interval;
  ELSE
    SELECT *
    INTO _custom_plan
    FROM public.teacher_custom_plans
    WHERE id = _sub.custom_plan_id
      AND teacher_id = _sub.teacher_id
      AND is_active = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'custom teacher plan not found' USING ERRCODE = 'P0002';
    END IF;

    _gross := round(_custom_plan.price, 2);
    _plan_interval := _custom_plan.interval;
  END IF;

  SELECT final_amount
  INTO _coupon_final_amount
  FROM public.coupon_redemptions
  WHERE subscription_id = _sub.id
    AND status IN ('checkout_created', 'paid')
  ORDER BY created_at DESC
  LIMIT 1;

  IF _coupon_final_amount IS NOT NULL AND _coupon_final_amount > 0 THEN
    _gross := round(_coupon_final_amount, 2);
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
    CASE _plan_interval
      WHEN 'trimestral' THEN _resolved_period_start + interval '3 months'
      WHEN 'anual' THEN _resolved_period_start + interval '1 year'
      ELSE _resolved_period_start + interval '1 month'
    END
  );

  _reference := coalesce(_reference, _subscription_id::text);
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
