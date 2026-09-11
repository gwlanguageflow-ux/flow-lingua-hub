-- Records an explicit, versioned acceptance for the terms that apply to each
-- account role. Writes happen only through authenticated server functions.
CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL CHECK (role IN ('professor', 'aluno')),
  terms_version text NOT NULL CHECK (char_length(trim(terms_version)) BETWEEN 3 AND 40),
  signer_name text NOT NULL CHECK (char_length(trim(signer_name)) BETWEEN 3 AND 160),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, terms_version)
);

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.terms_acceptances FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS terms_acceptances_user_version_idx
  ON public.terms_acceptances (user_id, terms_version, accepted_at DESC);
