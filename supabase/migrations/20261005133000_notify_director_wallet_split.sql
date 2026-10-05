-- Notification to Director regarding teacher wallet split (90% teacher / 10% platform)
DO $$
DECLARE
  v_sender_id uuid;
BEGIN
  -- Pick dev/admin profile to author the notification
  SELECT user_id INTO v_sender_id
  FROM public.user_roles
  WHERE role = 'dev'
  ORDER BY created_at ASC
  LIMIT 1;

  -- Fallback to first profile if no role found yet
  IF v_sender_id IS NULL THEN
    SELECT id INTO v_sender_id FROM public.profiles LIMIT 1;
  END IF;

  IF v_sender_id IS NOT NULL THEN
    INSERT INTO public.director_alerts (
      created_by,
      target_type,
      target_user_id,
      title,
      body,
      tone,
      active,
      starts_at
    ) VALUES (
      v_sender_id,
      'user',
      v_sender_id,
      'Regra de Carteira e Repasse Confirmada',
      'Olá Diretora! Atualizamos a plataforma com a confirmação da regra de repasse: quando o aluno paga a assinatura, o valor divide 90% para o saldo disponível do professor e 10% para a carteira da diretoria. O professor visualiza apenas o valor líquido já descontado da taxa, agora com detalhamento explícito no extrato financeiro (valor do plano, desconto de 10% e repasse líquido).',
      'info',
      true,
      now()
    );

    INSERT INTO public.director_messages (
      created_by,
      target_type,
      title,
      body
    ) VALUES (
      v_sender_id,
      'all',
      'Atualização: Transparência e Repasse na Carteira dos Professores',
      'Informamos que na carteira dos professores o saldo disponível e o histórico financeiro operam com a taxa de 10% da plataforma devidamente descontada antes de entrar no saldo. O professor recebe 90% do valor pago pelo aluno e a carteira da diretoria recebe os 10% correspondentes.'
    );
  END IF;
END $$;
