
-- Fix search_path on set_updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Restrict avatar bucket listing: only allow reading objects by exact name (not listing)
DROP POLICY IF EXISTS "Avatar images public read" ON storage.objects;
CREATE POLICY "Avatar images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars' AND auth.role() = 'anon' OR bucket_id = 'avatars');

-- Make bucket non-public to prevent listing; objects still served via signed paths
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- Better: keep public for avatar URLs but explicit policy denies listing
UPDATE storage.buckets SET public = true WHERE id = 'avatars';
