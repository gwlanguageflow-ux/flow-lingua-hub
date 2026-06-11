CREATE TABLE IF NOT EXISTS public.class_assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.class_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.student_profiles(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  note text,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT class_assignment_submissions_assignment_student_key UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_completed
  ON public.class_assignment_submissions (student_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_teacher_completed
  ON public.class_assignment_submissions (teacher_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment
  ON public.class_assignment_submissions (assignment_id);

ALTER TABLE public.class_assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Assignment submissions visible to participants" ON public.class_assignment_submissions;
CREATE POLICY "Assignment submissions visible to participants"
ON public.class_assignment_submissions
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
  OR teacher_id = auth.uid()
  OR public.has_role(auth.uid(), 'dev'::public.app_role)
);

DROP POLICY IF EXISTS "Students confirm own visible assignments" ON public.class_assignment_submissions;
CREATE POLICY "Students confirm own visible assignments"
ON public.class_assignment_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.class_assignments a
    WHERE a.id = class_assignment_submissions.assignment_id
      AND a.teacher_id = class_assignment_submissions.teacher_id
      AND (
        a.student_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.class_members cm
          WHERE cm.class_id = a.class_id
            AND cm.student_id = auth.uid()
            AND cm.status = 'ativo'
        )
        OR EXISTS (
          SELECT 1
          FROM public.student_subscriptions ss
          WHERE ss.teacher_id = a.teacher_id
            AND ss.student_id = auth.uid()
            AND ss.status = 'ativa'
        )
      )
  )
);

DROP POLICY IF EXISTS "Students update own assignment confirmations" ON public.class_assignment_submissions;
CREATE POLICY "Students update own assignment confirmations"
ON public.class_assignment_submissions
FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (
  student_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.class_assignments a
    WHERE a.id = class_assignment_submissions.assignment_id
      AND a.teacher_id = class_assignment_submissions.teacher_id
      AND (
        a.student_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.class_members cm
          WHERE cm.class_id = a.class_id
            AND cm.student_id = auth.uid()
            AND cm.status = 'ativo'
        )
        OR EXISTS (
          SELECT 1
          FROM public.student_subscriptions ss
          WHERE ss.teacher_id = a.teacher_id
            AND ss.student_id = auth.uid()
            AND ss.status = 'ativa'
        )
      )
  )
);

DROP POLICY IF EXISTS "Directors manage assignment submissions" ON public.class_assignment_submissions;
CREATE POLICY "Directors manage assignment submissions"
ON public.class_assignment_submissions
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'dev'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'dev'::public.app_role));

DROP TRIGGER IF EXISTS class_assignment_submissions_updated ON public.class_assignment_submissions;
CREATE TRIGGER class_assignment_submissions_updated
  BEFORE UPDATE ON public.class_assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.class_assignment_submissions TO authenticated;

ALTER TABLE public.class_assignment_submissions REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'class_assignment_submissions'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_assignment_submissions;
  END IF;
END $$;
