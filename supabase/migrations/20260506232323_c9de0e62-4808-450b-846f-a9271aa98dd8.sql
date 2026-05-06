
-- 1. Remover Stripe Connect do professor
ALTER TABLE public.teacher_profiles
  DROP COLUMN IF EXISTS stripe_account_id,
  DROP COLUMN IF EXISTS stripe_onboarding_complete,
  DROP COLUMN IF EXISTS stripe_charges_enabled;

-- 2. Limpar campos de split do booking (assinatura cobre)
ALTER TABLE public.bookings
  DROP COLUMN IF EXISTS platform_fee,
  DROP COLUMN IF EXISTS teacher_payout,
  DROP COLUMN IF EXISTS total_amount,
  DROP COLUMN IF EXISTS stripe_session_id,
  DROP COLUMN IF EXISTS payment_intent_id;

-- 3. Enums
DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('pendente','ativa','inadimplente','cancelada','expirada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('card','pix');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.plan_interval AS ENUM ('mensal','trimestral','anual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Catálogo de planos
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  features text[] NOT NULL DEFAULT '{}',
  price numeric(10,2) NOT NULL,
  interval public.plan_interval NOT NULL DEFAULT 'mensal',
  installments integer NOT NULL DEFAULT 1,
  hours_per_week numeric(4,2),
  stripe_price_id_card text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans public read" ON public.subscription_plans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Devs manage plans" ON public.subscription_plans
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'dev'));

CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Assinaturas dos alunos
CREATE TABLE IF NOT EXISTS public.student_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status public.subscription_status NOT NULL DEFAULT 'pendente',
  payment_method public.payment_method,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,
  last_payment_at timestamptz,
  terms_accepted_at timestamptz NOT NULL,
  terms_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subs_student ON public.student_subscriptions(student_id);
CREATE INDEX IF NOT EXISTS idx_subs_status ON public.student_subscriptions(status);

ALTER TABLE public.student_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Student views own sub" ON public.student_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = student_id OR public.has_role(auth.uid(),'dev'));
CREATE POLICY "Student inserts own sub" ON public.student_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Devs manage subs" ON public.student_subscriptions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'dev'));

CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.student_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 6. Helper para verificar se aluno pode agendar
CREATE OR REPLACE FUNCTION public.student_can_book(_student_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_subscriptions
    WHERE student_id = _student_id
      AND status = 'ativa'
      AND (current_period_end IS NULL OR current_period_end > now())
  )
$$;

-- 7. RLS booking: aluno só cria se pode
DROP POLICY IF EXISTS "Student creates booking" ON public.bookings;
CREATE POLICY "Student creates booking" ON public.bookings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id AND public.student_can_book(auth.uid()));

-- 8. Seed dos planos
INSERT INTO public.subscription_plans (slug,name,description,features,price,interval,installments,hours_per_week,sort_order) VALUES
('essencial','Essencial','Plano mensal com aulas semanais e materiais completos.',
  ARRAY['1 hora de aula por semana','8 arquivos mensais (revisões, listening, reading, atividades, homeworks)','Atividades personalizadas','Desafio da fluência'],
  179.90,'mensal',1,1.0,1),
('advanced','Advanced','Para quem quer evoluir mais rápido com foco em aperfeiçoamento.',
  ARRAY['Todos os benefícios do Essencial','2 horas de aula por semana','Foco em aperfeiçoar complicações','Revisões extras antes de avaliações'],
  299.90,'mensal',1,2.0,2),
('conversation','Conversation','Foco total em fala, fluência e quebra de bloqueios.',
  ARRAY['1 hora de conversação por semana','Aperfeiçoamento de fala','Desenvolvimento de autoconfiança','Quebra de bloqueios','Diálogo sobre tópicos variados'],
  169.90,'mensal',1,1.0,3),
('anual','Anual Advanced','Plano anual completo com benefícios exclusivos.',
  ARRAY['Todos os benefícios do Advanced','8 aulas por mês (4 conversation)','Atividades e dinâmicas especiais','12x R$ 269,90'],
  3238.80,'anual',12,2.0,4)
ON CONFLICT (slug) DO NOTHING;
