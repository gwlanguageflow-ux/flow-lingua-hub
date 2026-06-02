-- Remove overloads antigas que fazem o PostgREST nao conseguir escolher a RPC correta.
DROP FUNCTION IF EXISTS public.activate_paid_student_subscription(uuid, text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.activate_paid_student_subscription(uuid, text, timestamptz, timestamptz, text);
