CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.is_class_teacher(
  class_id_input uuid,
  teacher_id_input uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_groups cg
    WHERE cg.id = class_id_input
      AND cg.teacher_id = teacher_id_input
  );
$$;

CREATE OR REPLACE FUNCTION private.is_active_class_student(
  class_id_input uuid,
  student_id_input uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_members cm
    WHERE cm.class_id = class_id_input
      AND cm.student_id = student_id_input
      AND cm.status = 'ativo'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_teacher_of_active_student(
  teacher_id_input uuid,
  student_id_input uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_members cm
    JOIN public.class_groups cg ON cg.id = cm.class_id
    WHERE cg.teacher_id = teacher_id_input
      AND cm.student_id = student_id_input
      AND cm.status = 'ativo'
  );
$$;

REVOKE ALL ON FUNCTION private.is_class_teacher(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_active_class_student(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_teacher_of_active_student(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_class_teacher(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_active_class_student(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_teacher_of_active_student(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "Class groups visible to participants" ON public.class_groups;
CREATE POLICY "Class groups visible to participants"
ON public.class_groups
FOR SELECT
TO authenticated
USING (
  teacher_id = auth.uid()
  OR public.has_role(auth.uid(), 'dev'::public.app_role)
  OR private.is_active_class_student(id, auth.uid())
);

DROP POLICY IF EXISTS "Teachers manage own class groups" ON public.class_groups;
CREATE POLICY "Teachers manage own class groups"
ON public.class_groups
FOR ALL
TO authenticated
USING (
  teacher_id = auth.uid()
  OR public.has_role(auth.uid(), 'dev'::public.app_role)
)
WITH CHECK (
  teacher_id = auth.uid()
  OR public.has_role(auth.uid(), 'dev'::public.app_role)
);

DROP POLICY IF EXISTS "Class members visible to participants" ON public.class_members;
CREATE POLICY "Class members visible to participants"
ON public.class_members
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
  OR public.has_role(auth.uid(), 'dev'::public.app_role)
  OR private.is_class_teacher(class_id, auth.uid())
);

DROP POLICY IF EXISTS "Teachers manage own class members" ON public.class_members;
CREATE POLICY "Teachers manage own class members"
ON public.class_members
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'dev'::public.app_role)
  OR private.is_class_teacher(class_id, auth.uid())
)
WITH CHECK (
  public.has_role(auth.uid(), 'dev'::public.app_role)
  OR private.is_class_teacher(class_id, auth.uid())
);

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
  OR private.is_active_class_student(class_id, auth.uid())
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
      OR private.is_class_teacher(class_id, auth.uid())
    )
    AND (
      student_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.teacher_id = auth.uid()
          AND b.student_id = class_materials.student_id
      )
      OR private.is_teacher_of_active_student(auth.uid(), student_id)
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
  OR private.is_active_class_student(class_id, auth.uid())
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
USING (
  teacher_id = auth.uid()
  OR public.has_role(auth.uid(), 'dev'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'dev'::public.app_role)
  OR (
    teacher_id = auth.uid()
    AND (
      class_id IS NULL
      OR private.is_class_teacher(class_id, auth.uid())
    )
    AND (
      student_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.teacher_id = auth.uid()
          AND b.student_id = class_assignments.student_id
      )
      OR private.is_teacher_of_active_student(auth.uid(), student_id)
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
          OR private.is_active_class_student(m.class_id, auth.uid())
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
          OR private.is_active_class_student(a.class_id, auth.uid())
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
