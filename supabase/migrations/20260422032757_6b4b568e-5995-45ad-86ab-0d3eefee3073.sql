
-- Enums
CREATE TYPE public.app_role AS ENUM ('dev', 'professor', 'aluno');
CREATE TYPE public.language_level AS ENUM ('iniciante', 'basico', 'intermediario', 'avancado', 'fluente');
CREATE TYPE public.booking_status AS ENUM ('pendente', 'confirmado', 'concluido', 'cancelado');

-- Profiles (dados básicos)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  age INTEGER,
  avatar_url TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User Roles (separado por segurança)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function p/ verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Teacher profiles
CREATE TABLE public.teacher_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bio TEXT,
  experiences TEXT,
  lived_abroad BOOLEAN DEFAULT false,
  countries_lived TEXT,
  languages_spoken TEXT[] NOT NULL DEFAULT '{}',
  languages_taught TEXT[] NOT NULL DEFAULT '{}',
  levels_taught language_level[] NOT NULL DEFAULT '{}',
  hourly_rate NUMERIC(10,2),
  monthly_rate NUMERIC(10,2),
  package_8_rate NUMERIC(10,2),
  stripe_account_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;

-- Student profiles
CREATE TABLE public.student_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  desired_language TEXT NOT NULL,
  comprehension_level language_level NOT NULL DEFAULT 'iniciante',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

-- Teacher availability
CREATE TABLE public.teacher_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;

-- Bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  total_amount NUMERIC(10,2) NOT NULL,
  platform_fee NUMERIC(10,2) NOT NULL,
  teacher_payout NUMERIC(10,2) NOT NULL,
  status booking_status NOT NULL DEFAULT 'pendente',
  payment_intent_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_bookings_teacher ON public.bookings(teacher_id);
CREATE INDEX idx_bookings_student ON public.bookings(student_id);
CREATE INDEX idx_bookings_scheduled ON public.bookings(scheduled_at);

-- Reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- ===== RLS POLICIES =====

-- Profiles: todos autenticados podem ver, próprio usuário edita, dev edita tudo
CREATE POLICY "Profiles visible to authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Devs manage all profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'dev'));

-- user_roles: usuário vê suas roles, dev gerencia tudo
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'dev'));
CREATE POLICY "Devs manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'dev'));
CREATE POLICY "Users insert own non-dev role" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND role <> 'dev');

-- teacher_profiles: público (qualquer autenticado vê), professor edita o seu, dev tudo
CREATE POLICY "Teacher profiles visible" ON public.teacher_profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teacher updates own" ON public.teacher_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Teacher inserts own" ON public.teacher_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Devs manage teachers" ON public.teacher_profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'dev'));

-- student_profiles: aluno vê e edita o seu, dev tudo
CREATE POLICY "Student views own" ON public.student_profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'dev'));
CREATE POLICY "Student updates own" ON public.student_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Student inserts own" ON public.student_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Devs manage students" ON public.student_profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'dev'));

-- availability: público
CREATE POLICY "Availability public read" ON public.teacher_availability
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Teacher manages own availability" ON public.teacher_availability
  FOR ALL TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Devs manage availability" ON public.teacher_availability
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'dev'));

-- bookings: aluno e professor envolvidos
CREATE POLICY "Booking parties view" ON public.bookings
  FOR SELECT TO authenticated USING (
    auth.uid() = student_id OR auth.uid() = teacher_id OR public.has_role(auth.uid(), 'dev')
  );
CREATE POLICY "Student creates booking" ON public.bookings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Parties update booking" ON public.bookings
  FOR UPDATE TO authenticated USING (auth.uid() = student_id OR auth.uid() = teacher_id);
CREATE POLICY "Devs manage bookings" ON public.bookings
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'dev'));

-- reviews: leitura pública (autenticada), aluno cria
CREATE POLICY "Reviews public read" ON public.reviews
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Student creates review" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id);
CREATE POLICY "Devs manage reviews" ON public.reviews
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'dev'));

-- Trigger: auto-criar profile no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER teacher_profiles_updated BEFORE UPDATE ON public.teacher_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER student_profiles_updated BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER bookings_updated BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket para avatares
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users update own avatar" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
  );
