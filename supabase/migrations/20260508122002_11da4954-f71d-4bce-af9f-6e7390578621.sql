
-- 1. Identifica o ID da conta da diretoria
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id FROM auth.users WHERE email = 'gwlanguageflow@gmail.com' LIMIT 1;

  -- 2. Remove dados dependentes de todas as outras contas
  DELETE FROM public.bookings WHERE student_id <> admin_id AND teacher_id <> admin_id OR admin_id IS NULL;
  DELETE FROM public.reviews WHERE student_id <> admin_id AND teacher_id <> admin_id OR admin_id IS NULL;
  DELETE FROM public.student_subscriptions WHERE student_id <> admin_id OR admin_id IS NULL;
  DELETE FROM public.teacher_availability WHERE teacher_id <> admin_id OR admin_id IS NULL;
  DELETE FROM public.teacher_profiles WHERE id <> admin_id OR admin_id IS NULL;
  DELETE FROM public.student_profiles WHERE id <> admin_id OR admin_id IS NULL;
  DELETE FROM public.user_roles WHERE user_id <> admin_id OR admin_id IS NULL;
  DELETE FROM public.profiles WHERE id <> admin_id OR admin_id IS NULL;

  -- 3. Remove as contas de auth (exceto a diretoria, se existir)
  IF admin_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id <> admin_id;

    -- Garante role dev e nome correto
    INSERT INTO public.user_roles (user_id, role)
    VALUES (admin_id, 'dev')
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles
    SET full_name = 'Eloiza Gramacho'
    WHERE id = admin_id;
  ELSE
    -- Se a conta ainda não existir, apenas remove tudo
    DELETE FROM auth.users;
  END IF;
END $$;
