
UPDATE public.subscription_plans SET 
  description = '1 hora de aula semanal com foco em objetivos.',
  features = ARRAY[
    '1 hora de aula semanal',
    'Foco em objetivos pessoais',
    '4 arquivos mensais (revisão, listening, reading e atividades)',
    '4 homeworks',
    'Atividades personalizadas',
    'Desafio da influência'
  ]
WHERE slug = 'essencial';

UPDATE public.subscription_plans SET 
  description = 'Tudo do Essencial + 2h semanais e conversation extras.',
  features = ARRAY[
    'Todos os benefícios do Essencial',
    '2 horas de aula semanais',
    'Foco em aperfeiçoar complicações',
    'Revisão extra antes de avaliações',
    '2 aulas de conversation por mês'
  ]
WHERE slug = 'advanced';

UPDATE public.subscription_plans SET 
  description = '1 hora semanal dedicada à conversação.',
  features = ARRAY[
    '1 hora semanal de conversação',
    'Aperfeiçoamento e desenvolvimento de fala',
    'Quebra de bloqueios e autoconfiança',
    'Diálogo sobre tópicos variados'
  ]
WHERE slug = 'conversation';
