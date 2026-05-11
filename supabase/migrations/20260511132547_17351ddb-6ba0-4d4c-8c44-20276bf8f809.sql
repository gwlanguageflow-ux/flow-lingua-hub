UPDATE public.subscription_plans SET 
  features = ARRAY['1 hora de aula semanal','Foco em objetivos','4 arquivos mensais (revisão, arquivo com audição e leitura e atividades)','4 trabalhos de casa','Atividades personalizadas','Desafio da influência'],
  description = 'Para quem está começando uma jornada consistente.'
WHERE slug = 'essencial';

UPDATE public.subscription_plans SET 
  name = 'Avançado',
  features = ARRAY['Todos os benefícios do plano Essencial','2 horas de aula semanais','Foco em aperfeiçoamento de complicações','Revisão extra antes de avaliações','2 aulas de conversação mensais'],
  description = 'O plano mais escolhido por quem busca evolução acelerada.'
WHERE slug = 'advanced';

UPDATE public.subscription_plans SET 
  features = ARRAY['1 hora apenas de conversação','Foco em aperfeiçoamento e desenvolvimento de fala','Quebra de bloqueios e autoconfiança','Diálogo sobre tópicos variados'],
  description = 'Para quem já entende e quer destravar a fala.'
WHERE slug = 'conversation';

UPDATE public.subscription_plans SET is_active = false WHERE slug = 'anual';