ALTER TABLE public.class_groups
  ADD COLUMN IF NOT EXISTS modality text NOT NULL DEFAULT 'turma';

ALTER TABLE public.class_groups
  DROP CONSTRAINT IF EXISTS class_groups_modality_check;

ALTER TABLE public.class_groups
  ADD CONSTRAINT class_groups_modality_check
  CHECK (modality IN ('turma', 'particular'));

CREATE INDEX IF NOT EXISTS idx_class_groups_teacher_modality
  ON public.class_groups(teacher_id, modality);

ALTER TABLE public.discount_coupons
  ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_discount_coupons_teacher_active_visible
  ON public.discount_coupons(teacher_id, active)
  WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS "Coupons public read active" ON public.discount_coupons;
CREATE POLICY "Coupons public read active" ON public.discount_coupons
FOR SELECT
USING (
  active = true
  AND deleted_at IS NULL
  AND starts_at <= now()
  AND (expires_at IS NULL OR expires_at > now())
);

DROP POLICY IF EXISTS "Directors manage coupons" ON public.discount_coupons;
CREATE POLICY "Directors manage coupons" ON public.discount_coupons
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'dev'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'dev'::public.app_role));

DROP POLICY IF EXISTS "Teachers manage own coupons" ON public.discount_coupons;
CREATE POLICY "Teachers manage own coupons" ON public.discount_coupons
FOR ALL TO authenticated
USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'::public.app_role))
WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'dev'::public.app_role));

DROP POLICY IF EXISTS "Class materials visible to owners and students" ON public.class_materials;
CREATE POLICY "Class materials visible to owners and students"
ON public.class_materials
FOR SELECT
TO authenticated
USING (
  source = 'platform'
  OR teacher_id = auth.uid()
  OR created_by = auth.uid()
  OR student_id = auth.uid()
  OR public.has_role(auth.uid(), 'dev'::public.app_role)
  OR (
    class_id IS NOT NULL
    AND private.is_active_class_student(class_id, auth.uid())
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
  OR (
    class_id IS NOT NULL
    AND private.is_active_class_student(class_id, auth.uid())
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
          OR m.created_by = auth.uid()
          OR m.student_id = auth.uid()
          OR (
            m.class_id IS NOT NULL
            AND private.is_active_class_student(m.class_id, auth.uid())
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
          OR (
            a.class_id IS NOT NULL
            AND private.is_active_class_student(a.class_id, auth.uid())
          )
        )
    )
  )
);
