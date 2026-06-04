-- Corrige o nome comercial do plano advanced em bancos ja inicializados.

UPDATE public.subscription_plans
SET
  name = 'advanced',
  updated_at = now()
WHERE slug = 'advanced'
  AND name IS DISTINCT FROM 'advanced';
