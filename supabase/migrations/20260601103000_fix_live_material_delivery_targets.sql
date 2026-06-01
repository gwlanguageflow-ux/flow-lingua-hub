ALTER TABLE public.class_materials
  ALTER COLUMN class_id DROP NOT NULL;

ALTER TABLE public.class_assignments
  ALTER COLUMN class_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_student_subscriptions_teacher_student_status
  ON public.student_subscriptions (teacher_id, student_id, status);

UPDATE storage.buckets
SET
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 52428800),
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png',
    'image/jpeg',
    'image/webp',
    'audio/mpeg',
    'video/mp4'
  ]
WHERE id = 'learning-materials';

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
  OR EXISTS (
    SELECT 1
    FROM public.student_subscriptions ss
    WHERE ss.teacher_id = class_materials.teacher_id
      AND ss.student_id = auth.uid()
      AND ss.status = 'ativa'
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
      OR EXISTS (
        SELECT 1
        FROM public.student_subscriptions ss
        WHERE ss.teacher_id = auth.uid()
          AND ss.student_id = class_materials.student_id
          AND ss.status = 'ativa'
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
  OR EXISTS (
    SELECT 1
    FROM public.student_subscriptions ss
    WHERE ss.teacher_id = class_assignments.teacher_id
      AND ss.student_id = auth.uid()
      AND ss.status = 'ativa'
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
      OR EXISTS (
        SELECT 1
        FROM public.student_subscriptions ss
        WHERE ss.teacher_id = auth.uid()
          AND ss.student_id = class_assignments.student_id
          AND ss.status = 'ativa'
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
          OR EXISTS (
            SELECT 1
            FROM public.student_subscriptions ss
            WHERE ss.teacher_id = m.teacher_id
              AND ss.student_id = auth.uid()
              AND ss.status = 'ativa'
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
          OR EXISTS (
            SELECT 1
            FROM public.student_subscriptions ss
            WHERE ss.teacher_id = a.teacher_id
              AND ss.student_id = auth.uid()
              AND ss.status = 'ativa'
          )
        )
    )
  )
);
