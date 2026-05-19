CREATE TABLE IF NOT EXISTS public.policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL CHECK (slug IN (
    'politica-de-privacidade',
    'politica-de-cookies',
    'termos-de-uso',
    'politica-de-retencao',
    'seguranca',
    'menores'
  )),
  version text NOT NULL CHECK (char_length(trim(version)) BETWEEN 3 AND 40),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 160),
  summary text NOT NULL CHECK (char_length(trim(summary)) BETWEEN 10 AND 2000),
  content_hash text NOT NULL CHECK (char_length(trim(content_hash)) BETWEEN 12 AND 128),
  effective_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);

CREATE TABLE IF NOT EXISTS public.consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  visitor_id text,
  categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  policy_version text NOT NULL,
  privacy_policy_version text NOT NULL,
  cookies_policy_version text NOT NULL,
  accepted_all boolean NOT NULL DEFAULT false,
  rejected_all boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'cookie_banner' CHECK (source IN ('cookie_banner', 'privacy_center', 'admin', 'api')),
  ip_address inet,
  user_agent text,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR visitor_id IS NOT NULL),
  CHECK (jsonb_typeof(categories) = 'object')
);

CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_email text,
  requester_name text,
  request_type text NOT NULL CHECK (request_type IN (
    'access',
    'export',
    'correction',
    'deletion',
    'anonymization',
    'consent_revocation',
    'portability',
    'opposition',
    'information',
    'other'
  )),
  status text NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',
    'in_review',
    'waiting_user',
    'completed',
    'rejected',
    'cancelled'
  )),
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 5 AND 5000),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_response text,
  response_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  due_at timestamptz NOT NULL DEFAULT (now() + interval '15 days'),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (requester_email IS NULL OR requester_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL CHECK (char_length(trim(action)) BETWEEN 3 AND 120),
  entity_type text NOT NULL CHECK (char_length(trim(entity_type)) BETWEEN 2 AND 120),
  entity_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id text,
  event text NOT NULL CHECK (event IN ('login_success', 'login_failure', 'logout', 'password_reset', 'session_refreshed')),
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (char_length(trim(event_type)) BETWEEN 3 AND 120),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  route text,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE TABLE IF NOT EXISTS public.data_retention_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_category text NOT NULL UNIQUE,
  legal_basis text NOT NULL,
  retention_period text NOT NULL,
  retention_days integer NOT NULL CHECK (retention_days > 0),
  action text NOT NULL CHECK (action IN ('delete', 'anonymize', 'review', 'retain_minimum')),
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 2000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS policy_versions_active_idx
  ON public.policy_versions (slug, is_active, effective_at DESC);
CREATE INDEX IF NOT EXISTS consents_user_created_idx
  ON public.consents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS consents_visitor_created_idx
  ON public.consents (visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS privacy_requests_user_created_idx
  ON public.privacy_requests (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS privacy_requests_status_due_idx
  ON public.privacy_requests (status, due_at, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_created_idx
  ON public.audit_logs (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_created_idx
  ON public.audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_sessions_user_created_idx
  ON public.user_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_type_created_idx
  ON public.security_events (event_type, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_route_created_idx
  ON public.security_events (route, created_at DESC);

DROP TRIGGER IF EXISTS privacy_requests_updated ON public.privacy_requests;
CREATE TRIGGER privacy_requests_updated
  BEFORE UPDATE ON public.privacy_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS data_retention_rules_updated ON public.data_retention_rules;
CREATE TRIGGER data_retention_rules_updated
  BEFORE UPDATE ON public.data_retention_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_retention_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads active policy versions" ON public.policy_versions;
CREATE POLICY "Public reads active policy versions"
  ON public.policy_versions
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Devs manage policy versions" ON public.policy_versions;
CREATE POLICY "Devs manage policy versions"
  ON public.policy_versions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'dev'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'dev'::public.app_role));

DROP POLICY IF EXISTS "Users read own consents" ON public.consents;
CREATE POLICY "Users read own consents"
  ON public.consents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'dev'::public.app_role));

DROP POLICY IF EXISTS "Users insert own consents" ON public.consents;
CREATE POLICY "Users insert own consents"
  ON public.consents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Devs manage consents" ON public.consents;
CREATE POLICY "Devs manage consents"
  ON public.consents
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'dev'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'dev'::public.app_role));

DROP POLICY IF EXISTS "Users read own privacy requests" ON public.privacy_requests;
CREATE POLICY "Users read own privacy requests"
  ON public.privacy_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'dev'::public.app_role));

DROP POLICY IF EXISTS "Users insert own privacy requests" ON public.privacy_requests;
CREATE POLICY "Users insert own privacy requests"
  ON public.privacy_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Devs manage privacy requests" ON public.privacy_requests;
CREATE POLICY "Devs manage privacy requests"
  ON public.privacy_requests
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'dev'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'dev'::public.app_role));

DROP POLICY IF EXISTS "Devs read audit logs" ON public.audit_logs;
CREATE POLICY "Devs read audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'dev'::public.app_role));

DROP POLICY IF EXISTS "Users read own sessions" ON public.user_sessions;
CREATE POLICY "Users read own sessions"
  ON public.user_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'dev'::public.app_role));

DROP POLICY IF EXISTS "Devs read security events" ON public.security_events;
CREATE POLICY "Devs read security events"
  ON public.security_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'dev'::public.app_role));

DROP POLICY IF EXISTS "Authenticated reads active retention rules" ON public.data_retention_rules;
CREATE POLICY "Authenticated reads active retention rules"
  ON public.data_retention_rules
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'dev'::public.app_role));

DROP POLICY IF EXISTS "Devs manage retention rules" ON public.data_retention_rules;
CREATE POLICY "Devs manage retention rules"
  ON public.data_retention_rules
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'dev'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'dev'::public.app_role));

REVOKE ALL ON public.policy_versions FROM anon, authenticated;
REVOKE ALL ON public.consents FROM anon, authenticated;
REVOKE ALL ON public.privacy_requests FROM anon, authenticated;
REVOKE ALL ON public.audit_logs FROM anon, authenticated;
REVOKE ALL ON public.user_sessions FROM anon, authenticated;
REVOKE ALL ON public.security_events FROM anon, authenticated;
REVOKE ALL ON public.data_retention_rules FROM anon, authenticated;

GRANT SELECT ON public.policy_versions TO anon, authenticated;
GRANT SELECT, INSERT ON public.consents TO authenticated;
GRANT SELECT, INSERT ON public.privacy_requests TO authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT SELECT ON public.user_sessions TO authenticated;
GRANT SELECT ON public.security_events TO authenticated;
GRANT SELECT ON public.data_retention_rules TO authenticated;

CREATE OR REPLACE FUNCTION public.retention_cleanup_lgpd(_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _security_events integer := 0;
  _audit_logs integer := 0;
  _sessions integer := 0;
  _privacy_requests integer := 0;
  _revoked_consents integer := 0;
BEGIN
  SELECT count(*) INTO _security_events
  FROM public.security_events
  WHERE created_at < now() - interval '730 days';

  SELECT count(*) INTO _audit_logs
  FROM public.audit_logs
  WHERE created_at < now() - interval '1825 days';

  SELECT count(*) INTO _sessions
  FROM public.user_sessions
  WHERE created_at < now() - interval '730 days';

  SELECT count(*) INTO _privacy_requests
  FROM public.privacy_requests
  WHERE status IN ('completed', 'rejected', 'cancelled')
    AND updated_at < now() - interval '1825 days';

  SELECT count(*) INTO _revoked_consents
  FROM public.consents
  WHERE revoked_at IS NOT NULL
    AND revoked_at < now() - interval '1825 days';

  IF NOT _dry_run THEN
    DELETE FROM public.security_events WHERE created_at < now() - interval '730 days';
    DELETE FROM public.audit_logs WHERE created_at < now() - interval '1825 days';
    DELETE FROM public.user_sessions WHERE created_at < now() - interval '730 days';
    DELETE FROM public.privacy_requests
      WHERE status IN ('completed', 'rejected', 'cancelled')
        AND updated_at < now() - interval '1825 days';
    DELETE FROM public.consents
      WHERE revoked_at IS NOT NULL
        AND revoked_at < now() - interval '1825 days';
  END IF;

  RETURN jsonb_build_object(
    'dryRun', _dry_run,
    'securityEvents', _security_events,
    'auditLogs', _audit_logs,
    'userSessions', _sessions,
    'privacyRequests', _privacy_requests,
    'revokedConsents', _revoked_consents
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.retention_cleanup_lgpd(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.retention_cleanup_lgpd(boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.anonymize_profile_lgpd(
  _target_user_id uuid,
  _actor_user_id uuid,
  _reason text DEFAULT 'Solicitacao LGPD'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _anon_email text := 'anon+' || replace(_target_user_id::text, '-', '') || '@gwlanguageflow.local';
  _profile_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _target_user_id) INTO _profile_exists;

  IF NOT _profile_exists THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  END IF;

  UPDATE public.profiles
  SET
    full_name = 'Usuario anonimizado',
    email = _anon_email,
    cpf = NULL,
    age = NULL,
    avatar_url = NULL,
    updated_at = now()
  WHERE id = _target_user_id;

  UPDATE public.student_profiles
  SET desired_language = 'anonimizado',
      comprehension_level = 'iniciante',
      updated_at = now()
  WHERE id = _target_user_id;

  UPDATE public.teacher_profiles
  SET bio = NULL,
      experiences = NULL,
      lived_abroad = false,
      countries_lived = NULL,
      languages_spoken = '{}',
      languages_taught = '{}',
      levels_taught = '{}',
      hourly_rate = NULL,
      monthly_rate = NULL,
      package_8_rate = NULL,
      use_custom_pricing = false,
      custom_prices = '{}'::jsonb,
      is_active = false,
      updated_at = now()
  WHERE id = _target_user_id;

  UPDATE public.teacher_student_messages
  SET body = 'Mensagem anonimizada por solicitacao LGPD',
      read_at = coalesce(read_at, now())
  WHERE sender_id = _target_user_id;

  UPDATE public.director_user_messages
  SET body = 'Mensagem anonimizada por solicitacao LGPD'
  WHERE sender_id = _target_user_id OR user_id = _target_user_id;

  UPDATE public.consents
  SET revoked_at = coalesce(revoked_at, now())
  WHERE user_id = _target_user_id AND revoked_at IS NULL;

  INSERT INTO public.audit_logs (
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    _actor_user_id,
    'dev',
    'privacy.anonymize_user',
    'profiles',
    _target_user_id::text,
    jsonb_build_object('reason', _reason)
  );

  RETURN jsonb_build_object('ok', true, 'userId', _target_user_id, 'email', _anon_email);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.anonymize_profile_lgpd(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.anonymize_profile_lgpd(uuid, uuid, text) TO service_role;

INSERT INTO public.policy_versions (slug, version, title, summary, content_hash, effective_at, is_active)
VALUES
  ('politica-de-privacidade', '2026.05.19', 'Politica de Privacidade', 'Tratamento de dados pessoais da plataforma GWLanguageFlow.', 'gwlf-privacy-20260519', '2026-05-19 00:00:00-03', true),
  ('politica-de-cookies', '2026.05.19', 'Politica de Cookies', 'Uso de cookies necessarios, preferencias, analiticos, marketing e terceiros.', 'gwlf-cookies-20260519', '2026-05-19 00:00:00-03', true),
  ('termos-de-uso', '2026.05.19', 'Termos de Uso', 'Regras de uso da plataforma, assinaturas, aulas e responsabilidades.', 'gwlf-terms-20260519', '2026-05-19 00:00:00-03', true),
  ('politica-de-retencao', '2026.05.19', 'Politica de Retencao', 'Prazos de retencao, exclusao e anonimizacao de dados.', 'gwlf-retention-20260519', '2026-05-19 00:00:00-03', true),
  ('seguranca', '2026.05.19', 'Seguranca da Informacao', 'Medidas tecnicas e organizacionais de seguranca da plataforma.', 'gwlf-security-20260519', '2026-05-19 00:00:00-03', true),
  ('menores', '2026.05.19', 'Politica para Menores', 'Orientacoes para cadastro e uso por menores com responsavel legal.', 'gwlf-minors-20260519', '2026-05-19 00:00:00-03', true)
ON CONFLICT (slug, version) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content_hash = EXCLUDED.content_hash,
  effective_at = EXCLUDED.effective_at,
  is_active = true;

INSERT INTO public.data_retention_rules (
  data_category,
  legal_basis,
  retention_period,
  retention_days,
  action,
  description
)
VALUES
  ('account_profile', 'execucao de contrato e exercicio regular de direitos', 'vigencia da conta + 5 anos', 1825, 'anonymize', 'Dados cadastrais sao mantidos enquanto a conta existir e anonimizados apos solicitacao valida, preservando registros minimos quando necessarios.'),
  ('billing_records', 'execucao de contrato, obrigacao legal e exercicio regular de direitos', '5 anos', 1825, 'retain_minimum', 'Assinaturas, pagamentos, repasses e comprovantes financeiros sao preservados pelo prazo necessario para auditoria, contestacao e obrigacoes fiscais/consumeristas.'),
  ('learning_materials', 'execucao de contrato', 'vigencia da turma ou assinatura + 180 dias', 180, 'review', 'Materiais de aula permanecem disponiveis durante a relacao educacional e entram em revisao apos encerramento.'),
  ('messages', 'execucao de contrato e legitimo interesse', '2 anos apos encerramento', 730, 'anonymize', 'Mensagens operacionais podem ser anonimizadas quando nao forem necessarias para suporte, seguranca ou defesa de direitos.'),
  ('consents', 'cumprimento legal e comprovacao de consentimento', '5 anos apos revogacao', 1825, 'delete', 'Registros de consentimento sao mantidos para comprovar preferencia, versao aceita e revogacao.'),
  ('security_logs', 'legitimo interesse, seguranca e Marco Civil da Internet', '2 anos', 730, 'delete', 'Eventos de seguranca e sessoes sao preservados para rastreabilidade, prevencao de fraude e resposta a incidentes.'),
  ('audit_logs', 'exercicio regular de direitos e governanca', '5 anos', 1825, 'delete', 'Logs administrativos e de privacidade sao mantidos para auditoria e defesa de direitos.')
ON CONFLICT (data_category) DO UPDATE SET
  legal_basis = EXCLUDED.legal_basis,
  retention_period = EXCLUDED.retention_period,
  retention_days = EXCLUDED.retention_days,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  is_active = true,
  updated_at = now();
