ALTER TABLE public.class_materials
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.student_profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_class_materials_student
  ON public.class_materials(student_id);

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
    AND student_id IS NULL
    AND (
      class_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.class_groups cg
        WHERE cg.id = class_materials.class_id
          AND cg.teacher_id = auth.uid()
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
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.class_assignments a
      WHERE a.file_path = storage.objects.name
        AND (
          a.teacher_id = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.class_members cm
            WHERE cm.class_id = a.class_id
              AND cm.student_id = auth.uid()
              AND cm.status = 'ativo'
          )
        )
    )
  )
);
