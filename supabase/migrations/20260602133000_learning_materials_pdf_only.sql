UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY['application/pdf']::text[],
  file_size_limit = 20971520
WHERE id = 'learning-materials';
