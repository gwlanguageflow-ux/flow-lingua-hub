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
    OR EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = class_groups.id
        AND cm.student_id = auth.uid()
        AND cm.status = 'ativo'
    )
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
    OR EXISTS (
      SELECT 1 FROM public.class_groups cg
      WHERE cg.id = class_members.class_id
        AND cg.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers manage own class members" ON public.class_members;
CREATE POLICY "Teachers manage own class members" ON public.class_members
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'dev')
    OR EXISTS (
      SELECT 1 FROM public.class_groups cg
      WHERE cg.id = class_members.class_id
        AND cg.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'dev')
    OR EXISTS (
      SELECT 1 FROM public.class_groups cg
      WHERE cg.id = class_members.class_id
        AND cg.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Class materials visible to owners and students" ON public.class_materials;
CREATE POLICY "Class materials visible to owners and students" ON public.class_materials
  FOR SELECT TO authenticated
  USING (
    source = 'platform'
    OR teacher_id = auth.uid()
    OR public.has_role(auth.uid(), 'dev')
    OR EXISTS (
      SELECT 1
      FROM public.class_members cm
      WHERE cm.class_id = class_materials.class_id
        AND cm.student_id = auth.uid()
        AND cm.status = 'ativo'
    )
  );

DROP POLICY IF EXISTS "Teachers manage own class materials" ON public.class_materials;
CREATE POLICY "Teachers manage own class materials" ON public.class_materials
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'dev')
    OR teacher_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'dev')
    OR (
      teacher_id = auth.uid()
      AND (
        class_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.class_groups cg
          WHERE cg.id = class_materials.class_id
            AND cg.teacher_id = auth.uid()
        )
      )
    )
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
    teacher_id = auth.uid()
    OR public.has_role(auth.uid(), 'dev')
    OR EXISTS (
      SELECT 1 FROM public.class_members cm
      WHERE cm.class_id = class_assignments.class_id
        AND cm.student_id = auth.uid()
        AND cm.status = 'ativo'
    )
  );

DROP POLICY IF EXISTS "Teachers manage own assignments" ON public.class_assignments;
CREATE POLICY "Teachers manage own assignments" ON public.class_assignments
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'))
  WITH CHECK (
    public.has_role(auth.uid(), 'dev')
    OR (
      teacher_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.class_groups cg
        WHERE cg.id = class_assignments.class_id
          AND cg.teacher_id = auth.uid()
      )
    )
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
      OR EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.teacher_id = teacher_student_messages.teacher_id
          AND b.student_id = teacher_student_messages.student_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.class_members cm
        JOIN public.class_groups cg ON cg.id = cm.class_id
        WHERE cg.teacher_id = teacher_student_messages.teacher_id
          AND cm.student_id = teacher_student_messages.student_id
          AND cm.status = 'ativo'
      )
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
    AND (
      (teacher_id = auth.uid() AND sender_role = 'teacher')
      OR public.has_role(auth.uid(), 'dev')
    )
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
  USING (
    teacher_id IS NULL
    OR teacher_id = auth.uid()
    OR public.has_role(auth.uid(), 'dev')
  );

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

CREATE TRIGGER class_groups_updated
  BEFORE UPDATE ON public.class_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER class_materials_updated
  BEFORE UPDATE ON public.class_materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER material_requests_updated
  BEFORE UPDATE ON public.material_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER class_assignments_updated
  BEFORE UPDATE ON public.class_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER teacher_posts_updated
  BEFORE UPDATE ON public.teacher_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
VALUES (
  'learning-materials',
  'learning-materials',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'teacher-posts',
  'teacher-posts',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Learning materials authenticated read" ON storage.objects;
CREATE POLICY "Learning materials authenticated read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'learning-materials');

DROP POLICY IF EXISTS "Users upload learning materials" ON storage.objects;
CREATE POLICY "Users upload learning materials" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'learning-materials'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own learning materials" ON storage.objects;
CREATE POLICY "Users update own learning materials" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'learning-materials'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own learning materials" ON storage.objects;
CREATE POLICY "Users delete own learning materials" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'learning-materials'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Teacher post images public read" ON storage.objects;
CREATE POLICY "Teacher post images public read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'teacher-posts');

DROP POLICY IF EXISTS "Teachers upload own post images" ON storage.objects;
CREATE POLICY "Teachers upload own post images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'teacher-posts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Teachers update own post images" ON storage.objects;
CREATE POLICY "Teachers update own post images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'teacher-posts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Teachers delete own post images" ON storage.objects;
CREATE POLICY "Teachers delete own post images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'teacher-posts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

INSERT INTO public.class_materials (title, description, source)
VALUES
  ('Guia de estudos GWLanguageFlow', 'Material base da plataforma para organizacao da rotina semanal.', 'platform'),
  ('Modelo de revisao semanal', 'Estrutura padrao para revisar vocabulario, leitura, escuta e conversacao.', 'platform'),
  ('Checklist de progresso do aluno', 'Modelo para acompanhar presenca, atividade e evolucao por turma.', 'platform')
ON CONFLICT DO NOTHING;

INSERT INTO public.teacher_announcements (title, body, link_url)
VALUES (
  'Bem-vindo a area da secretaria',
  'Use este espaco para falar com a diretora, receber avisos pedagogicos e acompanhar reunioes importantes.',
  NULL
)
ON CONFLICT DO NOTHING;

ALTER TABLE public.teacher_student_messages REPLICA IDENTITY FULL;
ALTER TABLE public.teacher_secretariat_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_student_messages;
EXCEPTION
  WHEN duplicate_object OR undefined_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_secretariat_messages;
EXCEPTION
  WHEN duplicate_object OR undefined_object THEN NULL;
END $$;
