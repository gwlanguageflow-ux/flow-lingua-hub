-- Hardening pass for production readiness:
-- - anon should not have direct DML privileges on app tables.
-- - public reviews must match the real booking parties.
-- - anon should not execute SECURITY DEFINER role helpers directly.
-- - public buckets do not need broad object SELECT policies for public URLs.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;

DROP POLICY IF EXISTS "Student creates review" ON public.reviews;
CREATE POLICY "Student creates review"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = reviews.booking_id
      AND b.student_id = reviews.student_id
      AND b.teacher_id = reviews.teacher_id
      AND b.status <> 'cancelado'::public.booking_status
      AND b.scheduled_at <= now()
  )
);

DROP POLICY IF EXISTS "Public teacher posts are readable" ON public.teacher_posts;
DROP POLICY IF EXISTS "Authenticated teacher posts are readable" ON public.teacher_posts;

CREATE POLICY "Public teacher posts are readable"
ON public.teacher_posts
FOR SELECT
TO anon
USING (visibility = 'public');

CREATE POLICY "Authenticated teacher posts are readable"
ON public.teacher_posts
FOR SELECT
TO authenticated
USING (
  visibility = 'public'
  OR teacher_id = auth.uid()
  OR public.has_role(auth.uid(), 'dev'::public.app_role)
);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "Learning materials authenticated read" ON storage.objects;
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

DROP POLICY IF EXISTS "Teacher post images public read" ON storage.objects;

DROP POLICY IF EXISTS "Avatar images public read" ON storage.objects;
DROP POLICY IF EXISTS "Users read own avatar objects" ON storage.objects;
CREATE POLICY "Users read own avatar objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
