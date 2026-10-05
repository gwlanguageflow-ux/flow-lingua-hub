-- Notification to Director regarding the deployed improvements
DO $$
DECLARE
  v_sender_id uuid;
BEGIN
  -- Pick an admin/director profile to author the notification
  SELECT user_id INTO v_sender_id
  FROM public.user_roles
  WHERE role IN ('director', 'admin')
  ORDER BY CASE WHEN role = 'director' THEN 1 ELSE 2 END
  LIMIT 1;

  -- Fallback to first profile if no role found yet
  IF v_sender_id IS NULL THEN
    SELECT id INTO v_sender_id FROM public.profiles LIMIT 1;
  END IF;

  IF v_sender_id IS NOT NULL THEN
    INSERT INTO public.director_alerts (
      created_by,
      target_type,
      target_role,
      title,
      body,
      tone,
      active,
      starts_at
    ) VALUES (
      v_sender_id,
      'role',
      'director',
      'Melhorias do Sistema Publicadas',
      'Olá Diretora! As melhorias solicitadas no documento de auditoria foram implementadas e publicadas com sucesso: correção de recarregamento no cadastro de perfil, redirecionamento para o feed, links diretos de navegação, revisão de acentuação, diagnóstico aprimorado para assinaturas de alunos, pausa/ativação e exclusão de cupons, exibição de data de expiração em alertas Pix, novos filtros no histórico de aulas e organização de tarefas em pastas para professores, além de controle para excluir notificações.',
      'info',
      true,
      now()
    );
  END IF;
END $$;
