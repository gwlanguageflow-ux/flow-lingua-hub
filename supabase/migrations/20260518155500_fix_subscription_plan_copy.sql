UPDATE public.subscription_plans
SET features = array_replace(features, 'Desafio da influência', 'Desafio da fluência')
WHERE 'Desafio da influência' = ANY(features);

UPDATE public.subscription_plans
SET features = array_replace(
  features,
  'Foco em aperfeiçoamento de complicações',
  'Foco em aperfeiçoamento de pontos de dificuldade'
)
WHERE 'Foco em aperfeiçoamento de complicações' = ANY(features);

UPDATE public.subscription_plans
SET features = array_replace(
  features,
  'Foco em aperfeiçoar complicações',
  'Foco em aperfeiçoamento de pontos de dificuldade'
)
WHERE 'Foco em aperfeiçoar complicações' = ANY(features);
