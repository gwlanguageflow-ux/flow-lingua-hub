-- Add CPF as a required identity field for profile completion and password recovery.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf text;

UPDATE public.profiles
SET cpf = NULLIF(regexp_replace(cpf, '\D', '', 'g'), '')
WHERE cpf IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_cpf_format'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_cpf_format
      CHECK (cpf IS NULL OR cpf ~ '^\d{11}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_cpf_unique_idx
  ON public.profiles (cpf)
  WHERE cpf IS NOT NULL;

REVOKE SELECT (cpf) ON public.profiles FROM anon, authenticated;
GRANT SELECT (cpf) ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.get_own_onboarding_profile()
RETURNS TABLE (
  full_name text,
  cpf text,
  avatar_url text,
  age integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.full_name, p.cpf, p.avatar_url, p.age
  FROM public.profiles p
  WHERE p.id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_own_onboarding_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_onboarding_profile() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_valid_cpf(_cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _digits text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _sum integer;
  _digit integer;
  _i integer;
BEGIN
  IF _digits !~ '^\d{11}$' OR _digits ~ '^(\d)\1{10}$' THEN
    RETURN false;
  END IF;

  _sum := 0;
  FOR _i IN 1..9 LOOP
    _sum := _sum + substring(_digits, _i, 1)::integer * (11 - _i);
  END LOOP;
  _digit := (_sum * 10) % 11;
  IF _digit = 10 THEN
    _digit := 0;
  END IF;
  IF _digit <> substring(_digits, 10, 1)::integer THEN
    RETURN false;
  END IF;

  _sum := 0;
  FOR _i IN 1..10 LOOP
    _sum := _sum + substring(_digits, _i, 1)::integer * (12 - _i);
  END LOOP;
  _digit := (_sum * 10) % 11;
  IF _digit = 10 THEN
    _digit := 0;
  END IF;

  RETURN _digit = substring(_digits, 11, 1)::integer;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_valid_cpf(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_valid_cpf(text) TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cpf text := NULLIF(regexp_replace(coalesce(NEW.raw_user_meta_data->>'cpf', ''), '\D', '', 'g'), '');
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, cpf)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN public.is_valid_cpf(_cpf) THEN _cpf ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.complete_student_profile(text, integer, text, public.language_level, text);
DROP FUNCTION IF EXISTS public.complete_teacher_profile(text, integer, text, text, boolean, text, text[], text[], public.language_level[], boolean, jsonb, text);

CREATE OR REPLACE FUNCTION public.complete_student_profile(
  _full_name text,
  _cpf text,
  _age integer,
  _desired_language text,
  _comprehension_level public.language_level,
  _avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _email text;
  _normalized_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF length(trim(_full_name)) < 2 OR _age < 5 OR _age > 120 OR length(trim(_desired_language)) = 0 THEN
    RAISE EXCEPTION 'invalid student profile data' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_valid_cpf(_normalized_cpf) THEN
    RAISE EXCEPTION 'invalid cpf' USING ERRCODE = '22023';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _user_id;

  INSERT INTO public.profiles (id, full_name, cpf, age, email, avatar_url)
  VALUES (_user_id, trim(_full_name), _normalized_cpf, _age, _email, _avatar_url)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    cpf = EXCLUDED.cpf,
    age = EXCLUDED.age,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  INSERT INTO public.student_profiles (id, desired_language, comprehension_level)
  VALUES (_user_id, trim(_desired_language), _comprehension_level)
  ON CONFLICT (id) DO UPDATE SET
    desired_language = EXCLUDED.desired_language,
    comprehension_level = EXCLUDED.comprehension_level,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'aluno')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_teacher_profile(
  _full_name text,
  _cpf text,
  _age integer,
  _bio text,
  _experiences text,
  _lived_abroad boolean,
  _countries_lived text,
  _languages_spoken text[],
  _languages_taught text[],
  _levels_taught public.language_level[],
  _use_custom_pricing boolean,
  _custom_prices jsonb DEFAULT '{}'::jsonb,
  _avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _email text;
  _normalized_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _prices jsonb := coalesce(_custom_prices, '{}'::jsonb);
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF length(trim(_full_name)) < 2 OR _age < 18 OR _age > 120 OR length(trim(_bio)) < 20 THEN
    RAISE EXCEPTION 'invalid teacher profile data' USING ERRCODE = '22023';
  END IF;

  IF NOT public.is_valid_cpf(_normalized_cpf) THEN
    RAISE EXCEPTION 'invalid cpf' USING ERRCODE = '22023';
  END IF;

  IF coalesce(array_length(_languages_spoken, 1), 0) = 0
    OR coalesce(array_length(_languages_taught, 1), 0) = 0
    OR coalesce(array_length(_levels_taught, 1), 0) = 0
  THEN
    RAISE EXCEPTION 'teacher languages and levels are required' USING ERRCODE = '22023';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _user_id;

  INSERT INTO public.profiles (id, full_name, cpf, age, email, avatar_url)
  VALUES (_user_id, trim(_full_name), _normalized_cpf, _age, _email, _avatar_url)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    cpf = EXCLUDED.cpf,
    age = EXCLUDED.age,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  INSERT INTO public.teacher_profiles (
    id,
    bio,
    experiences,
    lived_abroad,
    countries_lived,
    languages_spoken,
    languages_taught,
    levels_taught,
    use_custom_pricing,
    custom_prices,
    hourly_rate,
    monthly_rate,
    package_8_rate
  )
  VALUES (
    _user_id,
    trim(_bio),
    NULLIF(trim(coalesce(_experiences, '')), ''),
    _lived_abroad,
    CASE WHEN _lived_abroad THEN NULLIF(trim(coalesce(_countries_lived, '')), '') ELSE NULL END,
    _languages_spoken,
    _languages_taught,
    _levels_taught,
    _use_custom_pricing,
    _prices,
    NULLIF(_prices->>'hourly', '')::numeric,
    NULLIF(_prices->>'monthly', '')::numeric,
    NULLIF(_prices->>'package_8', '')::numeric
  )
  ON CONFLICT (id) DO UPDATE SET
    bio = EXCLUDED.bio,
    experiences = EXCLUDED.experiences,
    lived_abroad = EXCLUDED.lived_abroad,
    countries_lived = EXCLUDED.countries_lived,
    languages_spoken = EXCLUDED.languages_spoken,
    languages_taught = EXCLUDED.languages_taught,
    levels_taught = EXCLUDED.levels_taught,
    use_custom_pricing = EXCLUDED.use_custom_pricing,
    custom_prices = EXCLUDED.custom_prices,
    hourly_rate = EXCLUDED.hourly_rate,
    monthly_rate = EXCLUDED.monthly_rate,
    package_8_rate = EXCLUDED.package_8_rate,
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'professor')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_student_profile(text, text, integer, text, public.language_level, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_teacher_profile(text, text, integer, text, text, boolean, text, text[], text[], public.language_level[], boolean, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_student_profile(text, text, integer, text, public.language_level, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_teacher_profile(text, text, integer, text, text, boolean, text, text[], text[], public.language_level[], boolean, jsonb, text) TO authenticated;

-- Purge prior student/teacher accounts (keep dev accounts).
DO $$
DECLARE
  _deleted_subscriptions integer := 0;
  _deleted_users integer := 0;
BEGIN
  CREATE TEMP TABLE tmp_accounts_to_purge ON COMMIT DROP AS
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('aluno', 'professor')
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles dev_role
      WHERE dev_role.user_id = ur.user_id
        AND dev_role.role = 'dev'
    );

  DELETE FROM public.student_subscriptions
  WHERE student_id IN (SELECT user_id FROM tmp_accounts_to_purge);
  GET DIAGNOSTICS _deleted_subscriptions = ROW_COUNT;

  DELETE FROM auth.users
  WHERE id IN (SELECT user_id FROM tmp_accounts_to_purge);
  GET DIAGNOSTICS _deleted_users = ROW_COUNT;

  RAISE NOTICE 'Purged % student/professor auth users and % student subscriptions.',
    _deleted_users,
    _deleted_subscriptions;
END $$;

-- Teacher wallet MVP.
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

  SELECT * INTO _booking FROM public.bookings WHERE id = _booking_id FOR UPDATE;
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
  WHERE t.booking_id = _booking_id AND t.transaction_type = 'lesson_credit';

  IF _transaction_id IS NOT NULL THEN
    RETURN QUERY
    SELECT t.id, t.amount, coalesce(t.platform_fee, 0)::numeric(12,2), coalesce(t.gross_amount, t.amount)::numeric(12,2)
    FROM public.teacher_wallet_transactions t WHERE t.id = _transaction_id;
    RETURN;
  END IF;

  SELECT ss.id, sp.price, sp.interval, sp.hours_per_week INTO _sub
  FROM public.student_subscriptions ss
  JOIN public.subscription_plans sp ON sp.id = ss.plan_id
  WHERE ss.student_id = _booking.student_id
    AND ss.status = 'ativa'
    AND (ss.current_period_start IS NULL OR ss.current_period_start <= _booking.scheduled_at)
    AND (ss.current_period_end IS NULL OR ss.current_period_end >= _booking.scheduled_at)
  ORDER BY ss.created_at DESC LIMIT 1;

  IF _sub.id IS NULL THEN
    RAISE EXCEPTION 'student has no active subscription for this booking' USING ERRCODE = '22023';
  END IF;

  _period_hours := CASE _sub.interval
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

  UPDATE public.bookings SET status = 'concluido', updated_at = now() WHERE id = _booking_id;

  INSERT INTO public.teacher_wallet_transactions (
    teacher_id, booking_id, transaction_type, amount, gross_amount, platform_fee, platform_fee_rate, description, created_by
  ) VALUES (
    _booking.teacher_id, _booking.id, 'lesson_credit', _teacher_amount, _gross, _platform_amount, 0.1000, 'Credito de aula concluida', _user_id
  ) RETURNING id INTO _transaction_id;

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
    teacher_id, amount, pix_key_type, pix_key, account_holder_name, account_holder_document, teacher_notes
  ) VALUES (
    _teacher_id, _normalized_amount, _pix_key_type, trim(_pix_key), trim(_account_holder_name),
    NULLIF(regexp_replace(coalesce(_account_holder_document, ''), '\D', '', 'g'), ''),
    NULLIF(trim(coalesce(_teacher_notes, '')), '')
  ) RETURNING id INTO _withdrawal_id;

  INSERT INTO public.teacher_wallet_transactions (
    teacher_id, withdrawal_request_id, transaction_type, amount, description, created_by
  ) VALUES (
    _teacher_id, _withdrawal_id, 'withdrawal_hold', -_normalized_amount, 'Solicitacao de saque via Pix', _teacher_id
  );

  RETURN _withdrawal_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_teacher_withdrawal(numeric, public.pix_key_type, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_teacher_withdrawal(numeric, public.pix_key_type, text, text, text, text) TO authenticated;

CREATE TRIGGER teacher_withdrawals_updated
BEFORE UPDATE ON public.teacher_withdrawal_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Learning workspace tables
CREATE TABLE IF NOT EXISTS public.class_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  language text NOT NULL,
  level public.language_level,
  day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time,
  end_time time,
  meeting_url text,
  description text,
  status text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'arquivada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado', 'removido')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.class_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES public.class_groups(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  source text NOT NULL DEFAULT 'teacher' CHECK (source IN ('platform', 'teacher', 'director')),
  file_path text,
  file_name text,
  file_mime_type text,
  external_url text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (file_path IS NOT NULL OR external_url IS NOT NULL OR source = 'platform')
);

CREATE TABLE IF NOT EXISTS public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.class_groups(id) ON DELETE SET NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_preparo', 'entregue', 'cancelado')),
  director_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  instructions text,
  file_path text,
  file_name text,
  file_mime_type text,
  external_url text,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (file_path IS NOT NULL OR external_url IS NOT NULL OR length(coalesce(instructions, '')) > 0)
);

CREATE TABLE IF NOT EXISTS public.student_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.class_groups(id) ON DELETE SET NULL,
  score numeric(5,2) CHECK (score IS NULL OR (score >= 0 AND score <= 10)),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_student_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_secretariat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_role text NOT NULL DEFAULT 'teacher' CHECK (sender_role IN ('teacher', 'director')),
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  link_url text,
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  meeting_url text,
  scheduled_at timestamptz NOT NULL,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teacher_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  caption text NOT NULL,
  image_path text,
  image_url text,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_class_groups_teacher ON public.class_groups(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_members_class ON public.class_members(class_id);
CREATE INDEX IF NOT EXISTS idx_class_members_student ON public.class_members(student_id);
CREATE INDEX IF NOT EXISTS idx_class_materials_class ON public.class_materials(class_id);
CREATE INDEX IF NOT EXISTS idx_class_materials_teacher ON public.class_materials(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_assignments_class_due ON public.class_assignments(class_id, due_at);
CREATE INDEX IF NOT EXISTS idx_teacher_student_messages_pair ON public.teacher_student_messages(teacher_id, student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_teacher_secretariat_messages_teacher ON public.teacher_secretariat_messages(teacher_id, created_at);
CREATE INDEX IF NOT EXISTS idx_teacher_posts_teacher ON public.teacher_posts(teacher_id, created_at DESC);

ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_student_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_secretariat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Class groups visible to participants" ON public.class_groups;
CREATE POLICY "Class groups visible to participants" ON public.class_groups
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid()
    OR public.has_role(auth.uid(), 'dev')
    OR EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = class_groups.id AND cm.student_id = auth.uid() AND cm.status = 'ativo')
  );

DROP POLICY IF EXISTS "Teachers manage own class groups" ON public.class_groups;
CREATE POLICY "Teachers manage own class groups" ON public.class_groups
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Class members visible to participants" ON public.class_members;
CREATE POLICY "Class members visible to participants" ON public.class_members
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.has_role(auth.uid(), 'dev')
    OR EXISTS (SELECT 1 FROM public.class_groups cg WHERE cg.id = class_members.class_id AND cg.teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS "Teachers manage own class members" ON public.class_members;
CREATE POLICY "Teachers manage own class members" ON public.class_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'dev') OR EXISTS (SELECT 1 FROM public.class_groups cg WHERE cg.id = class_members.class_id AND cg.teacher_id = auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'dev') OR EXISTS (SELECT 1 FROM public.class_groups cg WHERE cg.id = class_members.class_id AND cg.teacher_id = auth.uid()));

DROP POLICY IF EXISTS "Class materials visible to owners and students" ON public.class_materials;
CREATE POLICY "Class materials visible to owners and students" ON public.class_materials
  FOR SELECT TO authenticated
  USING (
    source = 'platform' OR teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev')
    OR EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = class_materials.class_id AND cm.student_id = auth.uid() AND cm.status = 'ativo')
  );

DROP POLICY IF EXISTS "Teachers manage own class materials" ON public.class_materials;
CREATE POLICY "Teachers manage own class materials" ON public.class_materials
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'dev') OR teacher_id = auth.uid())
  WITH CHECK (
    public.has_role(auth.uid(), 'dev')
    OR (teacher_id = auth.uid() AND (class_id IS NULL OR EXISTS (SELECT 1 FROM public.class_groups cg WHERE cg.id = class_materials.class_id AND cg.teacher_id = auth.uid())))
  );

DROP POLICY IF EXISTS "Teachers and devs manage material requests" ON public.material_requests;
CREATE POLICY "Teachers and devs manage material requests" ON public.material_requests
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Assignments visible to class participants" ON public.class_assignments;
CREATE POLICY "Assignments visible to class participants" ON public.class_assignments
  FOR SELECT TO authenticated
  USING (
    teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev')
    OR EXISTS (SELECT 1 FROM public.class_members cm WHERE cm.class_id = class_assignments.class_id AND cm.student_id = auth.uid() AND cm.status = 'ativo')
  );

DROP POLICY IF EXISTS "Teachers manage own assignments" ON public.class_assignments;
CREATE POLICY "Teachers manage own assignments" ON public.class_assignments
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'))
  WITH CHECK (
    public.has_role(auth.uid(), 'dev')
    OR (teacher_id = auth.uid() AND EXISTS (SELECT 1 FROM public.class_groups cg WHERE cg.id = class_assignments.class_id AND cg.teacher_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Scores visible to teacher and student" ON public.student_scores;
CREATE POLICY "Scores visible to teacher and student" ON public.student_scores
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR student_id = auth.uid() OR public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Teachers manage student scores" ON public.student_scores;
CREATE POLICY "Teachers manage student scores" ON public.student_scores
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Private messages visible to participants" ON public.teacher_student_messages;
CREATE POLICY "Private messages visible to participants" ON public.teacher_student_messages
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR student_id = auth.uid() OR public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Participants send private messages" ON public.teacher_student_messages;
CREATE POLICY "Participants send private messages" ON public.teacher_student_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (teacher_id = auth.uid() OR student_id = auth.uid() OR public.has_role(auth.uid(), 'dev'))
    AND (
      public.has_role(auth.uid(), 'dev')
      OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.teacher_id = teacher_student_messages.teacher_id AND b.student_id = teacher_student_messages.student_id)
      OR EXISTS (SELECT 1 FROM public.class_members cm JOIN public.class_groups cg ON cg.id = cm.class_id WHERE cg.teacher_id = teacher_student_messages.teacher_id AND cm.student_id = teacher_student_messages.student_id AND cm.status = 'ativo')
    )
  );

DROP POLICY IF EXISTS "Secretariat messages visible to teacher and devs" ON public.teacher_secretariat_messages;
CREATE POLICY "Secretariat messages visible to teacher and devs" ON public.teacher_secretariat_messages
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Teachers and devs send secretariat messages" ON public.teacher_secretariat_messages;
CREATE POLICY "Teachers and devs send secretariat messages" ON public.teacher_secretariat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND ((teacher_id = auth.uid() AND sender_role = 'teacher') OR public.has_role(auth.uid(), 'dev'))
  );

DROP POLICY IF EXISTS "Announcements visible to teachers" ON public.teacher_announcements;
CREATE POLICY "Announcements visible to teachers" ON public.teacher_announcements
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'professor') OR public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Devs manage announcements" ON public.teacher_announcements;
CREATE POLICY "Devs manage announcements" ON public.teacher_announcements
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'dev'))
  WITH CHECK (public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Teacher meetings visible to teachers" ON public.teacher_meetings;
CREATE POLICY "Teacher meetings visible to teachers" ON public.teacher_meetings
  FOR SELECT TO authenticated
  USING (teacher_id IS NULL OR teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Devs manage teacher meetings" ON public.teacher_meetings;
CREATE POLICY "Devs manage teacher meetings" ON public.teacher_meetings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'dev'))
  WITH CHECK (public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Public teacher posts are readable" ON public.teacher_posts;
CREATE POLICY "Public teacher posts are readable" ON public.teacher_posts
  FOR SELECT TO anon, authenticated
  USING (visibility = 'public' OR teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Teachers manage own posts" ON public.teacher_posts;
CREATE POLICY "Teachers manage own posts" ON public.teacher_posts
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'));

CREATE TRIGGER class_groups_updated BEFORE UPDATE ON public.class_groups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER class_materials_updated BEFORE UPDATE ON public.class_materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER material_requests_updated BEFORE UPDATE ON public.material_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER class_assignments_updated BEFORE UPDATE ON public.class_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER teacher_posts_updated BEFORE UPDATE ON public.teacher_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_materials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_scores TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.teacher_student_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.teacher_secretariat_messages TO authenticated;
GRANT SELECT ON public.teacher_announcements TO authenticated;
GRANT SELECT ON public.teacher_meetings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_posts TO authenticated;
GRANT SELECT ON public.teacher_posts TO anon;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('learning-materials', 'learning-materials', false, 20971520,
  ARRAY['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('teacher-posts', 'teacher-posts', true, 10485760, ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Learning materials authenticated read" ON storage.objects;
CREATE POLICY "Learning materials authenticated read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'learning-materials');

DROP POLICY IF EXISTS "Users upload learning materials" ON storage.objects;
CREATE POLICY "Users upload learning materials" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'learning-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users update own learning materials" ON storage.objects;
CREATE POLICY "Users update own learning materials" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'learning-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users delete own learning materials" ON storage.objects;
CREATE POLICY "Users delete own learning materials" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'learning-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Teacher post images public read" ON storage.objects;
CREATE POLICY "Teacher post images public read" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'teacher-posts');

DROP POLICY IF EXISTS "Teachers upload own post images" ON storage.objects;
CREATE POLICY "Teachers upload own post images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'teacher-posts' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Teachers update own post images" ON storage.objects;
CREATE POLICY "Teachers update own post images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'teacher-posts' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Teachers delete own post images" ON storage.objects;
CREATE POLICY "Teachers delete own post images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'teacher-posts' AND (storage.foldername(name))[1] = auth.uid()::text);

INSERT INTO public.class_materials (title, description, source)
VALUES
  ('Guia de estudos GWLanguageFlow', 'Material base da plataforma para organizacao da rotina semanal.', 'platform'),
  ('Modelo de revisao semanal', 'Estrutura padrao para revisar vocabulario, leitura, escuta e conversacao.', 'platform'),
  ('Checklist de progresso do aluno', 'Modelo para acompanhar presenca, atividade e evolucao por turma.', 'platform')
ON CONFLICT DO NOTHING;

INSERT INTO public.teacher_announcements (title, body, link_url)
VALUES ('Bem-vindo a area da secretaria', 'Use este espaco para falar com a diretora, receber avisos pedagogicos e acompanhar reunioes importantes.', NULL)
ON CONFLICT DO NOTHING;

ALTER TABLE public.teacher_student_messages REPLICA IDENTITY FULL;
ALTER TABLE public.teacher_secretariat_messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_student_messages;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_secretariat_messages;
EXCEPTION WHEN duplicate_object OR undefined_object THEN NULL; END $$;