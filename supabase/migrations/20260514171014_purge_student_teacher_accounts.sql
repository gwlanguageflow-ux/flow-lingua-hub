-- Remove previously created student and teacher accounts while preserving dev accounts.
-- This is a one-time data cleanup requested before reopening registration tests.
DO $$
DECLARE
  _deleted_subscriptions integer := 0;
  _deleted_users integer := 0;
BEGIN
  CREATE TEMP TABLE tmp_accounts_to_purge ON COMMIT DROP AS
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role IN ('aluno', 'professor')
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles dev_role
      WHERE dev_role.user_id = ur.user_id
        AND dev_role.role = 'dev'
    );

  DELETE FROM public.student_subscriptions
  WHERE student_id IN (SELECT user_id FROM tmp_accounts_to_purge);
  GET DIAGNOSTICS _deleted_subscriptions = ROW_COUNT;

  DELETE FROM auth.users
  WHERE id IN (SELECT user_id FROM tmp_accounts_to_purge);
  GET DIAGNOSTICS _deleted_users = ROW_COUNT;

  RAISE NOTICE 'Purged % student/professor auth users and % student subscriptions.',
    _deleted_users,
    _deleted_subscriptions;
END $$;
