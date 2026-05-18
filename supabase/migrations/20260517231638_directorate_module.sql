CREATE TABLE IF NOT EXISTS public.director_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('all', 'role', 'user', 'class')),
  target_role public.app_role,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_class_id uuid REFERENCES public.class_groups(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 120),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 3 AND 3000),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (target_type = 'all' AND target_role IS NULL AND target_user_id IS NULL AND target_class_id IS NULL)
    OR (target_type = 'role' AND target_role IS NOT NULL AND target_user_id IS NULL AND target_class_id IS NULL)
    OR (target_type = 'user' AND target_user_id IS NOT NULL AND target_role IS NULL AND target_class_id IS NULL)
    OR (target_type = 'class' AND target_class_id IS NOT NULL AND target_role IS NULL AND target_user_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.director_message_reads (
  message_id uuid NOT NULL REFERENCES public.director_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.director_user_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.anonymous_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'geral' CHECK (char_length(trim(category)) BETWEEN 3 AND 80),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 120),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 10 AND 3000),
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_analise', 'resolvido', 'arquivado')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.director_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('all', 'role', 'user', 'class')),
  target_role public.app_role,
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_class_id uuid REFERENCES public.class_groups(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 120),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 3 AND 2000),
  tone text NOT NULL DEFAULT 'info' CHECK (tone IN ('info', 'warning', 'urgent')),
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > starts_at),
  CHECK (
    (target_type = 'all' AND target_role IS NULL AND target_user_id IS NULL AND target_class_id IS NULL)
    OR (target_type = 'role' AND target_role IS NOT NULL AND target_user_id IS NULL AND target_class_id IS NULL)
    OR (target_type = 'user' AND target_user_id IS NOT NULL AND target_role IS NULL AND target_class_id IS NULL)
    OR (target_type = 'class' AND target_class_id IS NOT NULL AND target_role IS NULL AND target_user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS director_messages_target_idx
  ON public.director_messages (target_type, target_role, target_user_id, target_class_id, created_at DESC);
CREATE INDEX IF NOT EXISTS director_user_messages_user_created_idx
  ON public.director_user_messages (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS anonymous_reports_status_created_idx
  ON public.anonymous_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS director_alerts_target_active_idx
  ON public.director_alerts (active, target_type, target_role, target_user_id, target_class_id, starts_at DESC);

CREATE TRIGGER director_messages_updated
  BEFORE UPDATE ON public.director_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER anonymous_reports_updated
  BEFORE UPDATE ON public.anonymous_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER director_alerts_updated
  BEFORE UPDATE ON public.director_alerts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.director_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.director_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.director_user_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.director_alerts ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.director_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.director_message_reads TO authenticated;
GRANT SELECT, INSERT ON public.director_user_messages TO authenticated;
GRANT INSERT ON public.anonymous_reports TO authenticated;
GRANT SELECT, UPDATE ON public.anonymous_reports TO authenticated;
GRANT SELECT ON public.director_alerts TO authenticated;

CREATE POLICY "Dev manages director messages"
  ON public.director_messages
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'dev'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'dev'::public.app_role));

CREATE POLICY "Users read targeted director messages"
  ON public.director_messages
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'dev'::public.app_role)
    OR target_type = 'all'
    OR (target_type = 'role' AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = director_messages.target_role
    ))
    OR (target_type = 'user' AND target_user_id = auth.uid())
    OR (target_type = 'class' AND EXISTS (
      SELECT 1
      FROM public.class_members cm
      WHERE cm.class_id = director_messages.target_class_id
        AND cm.student_id = auth.uid()
        AND cm.status = 'ativo'
    ))
    OR (target_type = 'class' AND EXISTS (
      SELECT 1
      FROM public.class_groups cg
      WHERE cg.id = director_messages.target_class_id
        AND cg.teacher_id = auth.uid()
    ))
  );

CREATE POLICY "Users manage their own director message reads"
  ON public.director_message_reads
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'dev'::public.app_role) OR user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'dev'::public.app_role) OR user_id = auth.uid());

CREATE POLICY "Dev and participant read direct director chat"
  ON public.director_user_messages
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'dev'::public.app_role) OR user_id = auth.uid());

CREATE POLICY "Dev sends direct director chat"
  ON public.director_user_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'dev'::public.app_role)
    OR (sender_id = auth.uid() AND user_id = auth.uid())
  );

CREATE POLICY "Authenticated users create anonymous reports"
  ON public.anonymous_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Dev reads anonymous reports"
  ON public.anonymous_reports
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'dev'::public.app_role));

CREATE POLICY "Dev updates anonymous reports"
  ON public.anonymous_reports
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'dev'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'dev'::public.app_role));

CREATE POLICY "Dev manages director alerts"
  ON public.director_alerts
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'dev'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'dev'::public.app_role));

CREATE POLICY "Users read targeted active director alerts"
  ON public.director_alerts
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'dev'::public.app_role)
    OR (
      active = true
      AND starts_at <= now()
      AND (expires_at IS NULL OR expires_at > now())
      AND (
        target_type = 'all'
        OR (target_type = 'role' AND EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = auth.uid()
            AND ur.role = director_alerts.target_role
        ))
        OR (target_type = 'user' AND target_user_id = auth.uid())
        OR (target_type = 'class' AND EXISTS (
          SELECT 1
          FROM public.class_members cm
          WHERE cm.class_id = director_alerts.target_class_id
            AND cm.student_id = auth.uid()
            AND cm.status = 'ativo'
        ))
        OR (target_type = 'class' AND EXISTS (
          SELECT 1
          FROM public.class_groups cg
          WHERE cg.id = director_alerts.target_class_id
            AND cg.teacher_id = auth.uid()
        ))
      )
    )
  );
