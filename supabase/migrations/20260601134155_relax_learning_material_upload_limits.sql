UPDATE storage.buckets
SET
  file_size_limit = GREATEST(COALESCE(file_size_limit, 0), 524288000),
  allowed_mime_types = NULL
WHERE id = 'learning-materials';
