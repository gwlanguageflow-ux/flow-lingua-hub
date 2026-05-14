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
