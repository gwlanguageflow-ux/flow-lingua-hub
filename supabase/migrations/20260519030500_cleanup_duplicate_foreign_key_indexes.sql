DROP INDEX IF EXISTS public.idx_bookings_student_id_fkey_934567bf;
DROP INDEX IF EXISTS public.idx_bookings_teacher_id_fkey_0a235a6f;
DROP INDEX IF EXISTS public.idx_class_groups_teacher_id_fkey_8de2a008;
DROP INDEX IF EXISTS public.idx_class_materials_class_id_fkey_82508d6f;
DROP INDEX IF EXISTS public.idx_class_materials_teacher_id_fkey_f7d7fdc7;
DROP INDEX IF EXISTS public.idx_class_members_class_id_fkey_e950de9b;
DROP INDEX IF EXISTS public.idx_profiles_id_fkey_267f6b95;
DROP INDEX IF EXISTS public.idx_reviews_booking_id_fkey_67976080;
DROP INDEX IF EXISTS public.idx_student_profiles_id_fkey_94e18f6c;
DROP INDEX IF EXISTS public.idx_teacher_profiles_id_fkey_a4cbc417;

DO $$
DECLARE
  fk record;
  index_name text;
  column_list text;
BEGIN
  FOR fk IN
    SELECT
      n.nspname AS schema_name,
      rel.relname AS table_name,
      con.conname AS constraint_name,
      con.conkey::smallint[] AS conkey
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE con.contype = 'f'
      AND n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_index idx
        CROSS JOIN LATERAL (
          SELECT array_agg(key.attnum::smallint ORDER BY key.ord) AS index_prefix
          FROM unnest(idx.indkey) WITH ORDINALITY AS key(attnum, ord)
          WHERE key.ord <= array_length(con.conkey::smallint[], 1)
        ) prefix
        WHERE idx.indrelid = con.conrelid
          AND idx.indisvalid
          AND prefix.index_prefix = con.conkey::smallint[]
      )
    ORDER BY rel.relname, con.conname
  LOOP
    SELECT string_agg(format('%I', att.attname), ', ' ORDER BY cols.ord)
      INTO column_list
    FROM unnest(fk.conkey) WITH ORDINALITY AS cols(attnum, ord)
    JOIN pg_attribute att
      ON att.attrelid = format('%I.%I', fk.schema_name, fk.table_name)::regclass
     AND att.attnum = cols.attnum;

    index_name := left('idx_' || fk.constraint_name, 54) || '_' || substr(md5(fk.constraint_name), 1, 8);

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (%s)',
      index_name,
      fk.schema_name,
      fk.table_name,
      column_list
    );
  END LOOP;
END $$;
