-- Profile photos are part of the public teacher/student profile UI.
-- Keep the bucket public and allow Data API/storage reads for rendered avatars.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = COALESCE(storage.buckets.file_size_limit, EXCLUDED.file_size_limit),
  allowed_mime_types = COALESCE(storage.buckets.allowed_mime_types, EXCLUDED.allowed_mime_types);

DROP POLICY IF EXISTS "Avatar images public read" ON storage.objects;
DROP POLICY IF EXISTS "Users read own avatar objects" ON storage.objects;

CREATE POLICY "Avatar images public read"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatars');
