-- Padroniza nomes comerciais dos planos e adiciona cupons da plataforma/professor.

UPDATE public.subscription_plans
SET
  name = 'essential',
  description = 'Para quem esta comecando uma jornada consistente.',
  features = ARRAY[
    '1 hora de aula semanal',
    'Foco em objetivos',
    '4 arquivos mensais (revisao, arquivo com audicao e leitura e atividades)',
    '4 trabalhos de casa',
    'Atividades personalizadas',
    'Desafio da fluencia'
  ],
  price = 179.90,
  validapay_product_id = NULL,
  validapay_price_id = NULL
WHERE slug IN ('essencial', 'essential');

UPDATE public.subscription_plans
SET
  name = 'advanced',
  description = 'Para quem busca evolucao acelerada com mais horas de acompanhamento.',
  features = ARRAY[
    'Todos os beneficios do plano essential',
    '2 horas de aula semanais',
    'Foco em aperfeicoamento de pontos de dificuldade',
    'Revisao extra antes de avaliacoes',
    '2 aulas de conversacao mensais'
  ],
  price = 299.90,
  validapay_product_id = NULL,
  validapay_price_id = NULL
WHERE slug = 'advanced';

UPDATE public.subscription_plans
SET
  name = 'conversation',
  description = 'Para quem ja entende e quer destravar a fala.',
  features = ARRAY[
    '1 hora apenas de conversacao',
    'Foco em aperfeicoamento e desenvolvimento de fala',
    'Quebra de bloqueios e autoconfianca',
    'Dialogo sobre topicos variados'
  ],
  price = 169.90,
  validapay_product_id = NULL,
  validapay_price_id = NULL
WHERE slug = 'conversation';

UPDATE public.subscription_plans
SET is_active = false
WHERE slug = 'anual';

CREATE TABLE IF NOT EXISTS public.discount_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 1 AND 80),
  scope text NOT NULL DEFAULT 'director' CHECK (scope IN ('director', 'teacher', 'family')),
  teacher_id uuid REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  title text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discount_coupons_code_format CHECK (code ~ '^[A-Z]{4}-?[0-9]{2}$'),
  CONSTRAINT discount_coupons_teacher_scope CHECK (
    (scope = 'teacher' AND teacher_id IS NOT NULL)
    OR (scope <> 'teacher')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discount_coupons_one_active_teacher
  ON public.discount_coupons (teacher_id)
  WHERE scope = 'teacher' AND active = true;

CREATE INDEX IF NOT EXISTS idx_discount_coupons_active
  ON public.discount_coupons (active, scope, starts_at, expires_at);

ALTER TABLE public.discount_coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coupons public read active" ON public.discount_coupons;
CREATE POLICY "Coupons public read active" ON public.discount_coupons
  FOR SELECT TO anon, authenticated
  USING (
    active = true
    AND starts_at <= now()
    AND (expires_at IS NULL OR expires_at > now())
  );

DROP POLICY IF EXISTS "Directors manage coupons" ON public.discount_coupons;
CREATE POLICY "Directors manage coupons" ON public.discount_coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'dev'))
  WITH CHECK (public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Teachers manage own coupons" ON public.discount_coupons;
CREATE POLICY "Teachers manage own coupons" ON public.discount_coupons
  FOR ALL TO authenticated
  USING (scope = 'teacher' AND teacher_id = auth.uid())
  WITH CHECK (scope = 'teacher' AND teacher_id = auth.uid());

GRANT SELECT ON public.discount_coupons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.discount_coupons TO authenticated;

DROP TRIGGER IF EXISTS trg_discount_coupons_updated ON public.discount_coupons;
CREATE TRIGGER trg_discount_coupons_updated
  BEFORE UPDATE ON public.discount_coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.discount_coupons(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teacher_profiles(id) ON DELETE SET NULL,
  subscription_id uuid REFERENCES public.student_subscriptions(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  original_amount numeric(10,2) NOT NULL,
  discount_amount numeric(10,2) NOT NULL,
  final_amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'checkout_created' CHECK (status IN ('checkout_created', 'paid', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON public.coupon_redemptions (coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_subscription ON public.coupon_redemptions (subscription_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_student ON public.coupon_redemptions (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_one_checkout_per_subscription
  ON public.coupon_redemptions (subscription_id)
  WHERE subscription_id IS NOT NULL AND status = 'checkout_created';

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors view coupon redemptions" ON public.coupon_redemptions;
CREATE POLICY "Directors view coupon redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Teachers view own coupon redemptions" ON public.coupon_redemptions;
CREATE POLICY "Teachers view own coupon redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (teacher_id = auth.uid());

DROP POLICY IF EXISTS "Students view own coupon redemptions" ON public.coupon_redemptions;
CREATE POLICY "Students view own coupon redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

GRANT SELECT ON public.coupon_redemptions TO authenticated;

CREATE TABLE IF NOT EXISTS public.discounted_plan_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 1 AND 80),
  final_amount numeric(10,2) NOT NULL,
  validapay_product_id text,
  validapay_price_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, discount_percent)
);

CREATE INDEX IF NOT EXISTS idx_discounted_plan_prices_plan
  ON public.discounted_plan_prices (plan_id, discount_percent);

ALTER TABLE public.discounted_plan_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Directors manage discounted plan prices" ON public.discounted_plan_prices;
CREATE POLICY "Directors manage discounted plan prices" ON public.discounted_plan_prices
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'dev'))
  WITH CHECK (public.has_role(auth.uid(), 'dev'));

GRANT SELECT ON public.discounted_plan_prices TO authenticated;

DROP TRIGGER IF EXISTS trg_discounted_plan_prices_updated ON public.discounted_plan_prices;
CREATE TRIGGER trg_discounted_plan_prices_updated
  BEFORE UPDATE ON public.discounted_plan_prices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.family_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_student_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_student_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  code text UNIQUE NOT NULL CHECK (code ~ '^FAM[A-Z0-9]{5}$'),
  first_month_discount_percent integer NOT NULL DEFAULT 10,
  lifetime_discount_percent integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'used', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students view own family invites" ON public.family_invites;
CREATE POLICY "Students view own family invites" ON public.family_invites
  FOR SELECT TO authenticated
  USING (sponsor_student_id = auth.uid() OR invited_student_id = auth.uid() OR public.has_role(auth.uid(), 'dev'));

DROP POLICY IF EXISTS "Students create own family invites" ON public.family_invites;
CREATE POLICY "Students create own family invites" ON public.family_invites
  FOR INSERT TO authenticated
  WITH CHECK (sponsor_student_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.family_invites TO authenticated;
