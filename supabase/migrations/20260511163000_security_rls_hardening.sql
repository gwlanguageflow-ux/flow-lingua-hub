-- Security hardening for RLS policies, role assignment, profile e-mail exposure, and signup flows.

-- Make role helpers callable by authenticated users while preventing arbitrary role probing.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_user_id = auth.uid(), false)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.student_can_book(_student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_student_id = auth.uid(), false)
    AND EXISTS (
      SELECT 1
      FROM public.student_subscriptions
      WHERE student_id = _student_id
        AND status = 'ativa'
        AND (current_period_end IS NULL OR current_period_end > now())
    )
$$;

REVOKE EXECUTE ON FUNCTION public.student_can_book(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_can_book(uuid) TO authenticated, service_role;

-- Do not expose profile e-mails through broad authenticated profile reads.
REVOKE SELECT (email) ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, full_name, age, avatar_url, created_at, updated_at) ON public.profiles TO authenticated;
GRANT SELECT (email) ON public.profiles TO service_role;

-- Role assignment must happen through controlled backend functions, not direct table inserts.
DROP POLICY IF EXISTS "Users insert own non-dev role" ON public.user_roles;
DROP POLICY IF EXISTS "Devs manage roles" ON public.user_roles;
CREATE POLICY "Devs manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'dev'))
  WITH CHECK (public.has_role(auth.uid(), 'dev'));

-- Stripe identifiers are server-managed only.
DROP POLICY IF EXISTS "Student inserts own sub" ON public.student_subscriptions;
DROP POLICY IF EXISTS "Devs manage subs" ON public.student_subscriptions;
CREATE POLICY "Devs manage subs" ON public.student_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'dev'))
  WITH CHECK (public.has_role(auth.uid(), 'dev'));

-- Prevent students/teachers from changing the parties attached to an existing booking.
CREATE OR REPLACE FUNCTION public.prevent_booking_party_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'dev')
    AND (NEW.student_id IS DISTINCT FROM OLD.student_id OR NEW.teacher_id IS DISTINCT FROM OLD.teacher_id)
  THEN
    RAISE EXCEPTION 'booking parties cannot be changed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_booking_party_changes ON public.bookings;
CREATE TRIGGER prevent_booking_party_changes
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.prevent_booking_party_changes();

DROP POLICY IF EXISTS "Parties update booking" ON public.bookings;
CREATE POLICY "Parties update booking" ON public.bookings
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id OR auth.uid() = teacher_id OR public.has_role(auth.uid(), 'dev'))
  WITH CHECK (auth.uid() = student_id OR auth.uid() = teacher_id OR public.has_role(auth.uid(), 'dev'));

-- Reviews must be tied to a real, non-cancelled booking owned by the reviewing student.
DROP POLICY IF EXISTS "Student creates review" ON public.reviews;
CREATE POLICY "Student creates review" ON public.reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.id = booking_id
        AND b.student_id = student_id
        AND b.teacher_id = teacher_id
        AND b.status <> 'cancelado'
        AND b.scheduled_at <= now()
    )
  );

-- Allow users to delete their own avatar objects.
CREATE POLICY "Users delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Controlled profile completion RPCs used by the onboarding screens.
CREATE OR REPLACE FUNCTION public.complete_student_profile(
  _full_name text,
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
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF length(trim(_full_name)) < 2 OR _age < 5 OR _age > 120 OR length(trim(_desired_language)) = 0 THEN
    RAISE EXCEPTION 'invalid student profile data' USING ERRCODE = '22023';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _user_id;

  INSERT INTO public.profiles (id, full_name, age, email, avatar_url)
  VALUES (_user_id, trim(_full_name), _age, _email, _avatar_url)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
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
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF length(trim(_full_name)) < 2 OR _age < 18 OR _age > 120 OR length(trim(_bio)) < 20 THEN
    RAISE EXCEPTION 'invalid teacher profile data' USING ERRCODE = '22023';
  END IF;

  IF coalesce(array_length(_languages_spoken, 1), 0) = 0
    OR coalesce(array_length(_languages_taught, 1), 0) = 0
    OR coalesce(array_length(_levels_taught, 1), 0) = 0
  THEN
    RAISE EXCEPTION 'teacher languages and levels are required' USING ERRCODE = '22023';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _user_id;

  INSERT INTO public.profiles (id, full_name, age, email, avatar_url)
  VALUES (_user_id, trim(_full_name), _age, _email, _avatar_url)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
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
    coalesce(_custom_prices, '{}'::jsonb),
    NULLIF(_custom_prices->>'hourly', '')::numeric,
    NULLIF(_custom_prices->>'monthly', '')::numeric,
    NULLIF(_custom_prices->>'package_8', '')::numeric
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

REVOKE EXECUTE ON FUNCTION public.complete_student_profile(text, integer, text, public.language_level, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_teacher_profile(text, integer, text, text, boolean, text, text[], text[], public.language_level[], boolean, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_student_profile(text, integer, text, public.language_level, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_teacher_profile(text, integer, text, text, boolean, text, text[], text[], public.language_level[], boolean, jsonb, text) TO authenticated;
