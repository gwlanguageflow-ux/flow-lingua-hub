CREATE TABLE IF NOT EXISTS public.teacher_payout_profiles (
  teacher_id uuid PRIMARY KEY REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  pix_key_type public.pix_key_type NOT NULL,
  pix_key text NOT NULL CHECK (length(trim(pix_key)) BETWEEN 3 AND 200),
  account_holder_name text NOT NULL CHECK (length(trim(account_holder_name)) >= 2),
  account_holder_document text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teacher_payout_profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS teacher_payout_profiles_updated ON public.teacher_payout_profiles;
CREATE TRIGGER teacher_payout_profiles_updated
BEFORE UPDATE ON public.teacher_payout_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "Teachers manage own payout profile" ON public.teacher_payout_profiles;
CREATE POLICY "Teachers manage own payout profile"
ON public.teacher_payout_profiles
FOR ALL
TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "Devs manage teacher payout profiles" ON public.teacher_payout_profiles;
CREATE POLICY "Devs manage teacher payout profiles"
ON public.teacher_payout_profiles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'dev'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'dev'::public.app_role));

REVOKE ALL ON public.teacher_payout_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.teacher_payout_profiles TO authenticated;

INSERT INTO public.teacher_payout_profiles (
  teacher_id,
  pix_key_type,
  pix_key,
  account_holder_name,
  account_holder_document
)
SELECT
  teacher.id,
  'cpf'::public.pix_key_type,
  profile.cpf,
  coalesce(nullif(trim(profile.full_name), ''), 'Professor'),
  profile.cpf
FROM public.teacher_profiles teacher
JOIN public.profiles profile ON profile.id = teacher.id
WHERE profile.cpf IS NOT NULL
  AND trim(profile.cpf) <> ''
ON CONFLICT (teacher_id) DO NOTHING;
