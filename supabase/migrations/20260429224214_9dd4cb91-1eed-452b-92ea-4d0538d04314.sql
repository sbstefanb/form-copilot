
-- Profiles table for storing user display name
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Status enum
CREATE TYPE public.report_status AS ENUM ('u_izradi', 'ceka_analizu', 'zavrsen');

-- Counter table for evidencioni broj per year
CREATE TABLE public.report_counters (
  year INT PRIMARY KEY,
  last_seq INT NOT NULL DEFAULT 0
);

-- Failure reports
CREATE TABLE public.failure_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evidencioni_broj TEXT UNIQUE NOT NULL,
  status public.report_status NOT NULL DEFAULT 'u_izradi',
  datum DATE NOT NULL DEFAULT CURRENT_DATE,
  vrsta_kvara TEXT,
  vrsta_kvara_ostalo TEXT,
  pogon TEXT,
  tehnoloska_linija TEXT,
  tehnicki_sistem TEXT,
  sklop_podsklop TEXT,
  vreme_prijave TIMESTAMPTZ,
  vreme_otklanjanja TIMESTAMPTZ,
  uzrok TEXT,
  posledice TEXT,
  nacin_otklanjanja TEXT,
  ugradjeni_delovi JSONB NOT NULL DEFAULT '[]'::jsonb,
  imena_angazovanih JSONB NOT NULL DEFAULT '[]'::jsonb,
  broj_izvrsilaca INT,
  ostale_usluge TEXT,
  napomena TEXT,
  ispunio TEXT,
  tehnicka_analiza TEXT,
  analizu_izvrsio TEXT,
  korektivna_mera TEXT,
  korektivnu_meru_predlozio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.failure_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reports" ON public.failure_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own reports" ON public.failure_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reports" ON public.failure_reports FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reports" ON public.failure_reports FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_failure_reports_updated_at
  BEFORE UPDATE ON public.failure_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-generate evidencioni_broj
CREATE OR REPLACE FUNCTION public.generate_evidencioni_broj()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yr INT := EXTRACT(YEAR FROM COALESCE(NEW.datum, CURRENT_DATE))::INT;
  next_seq INT;
BEGIN
  IF NEW.evidencioni_broj IS NULL OR NEW.evidencioni_broj = '' THEN
    INSERT INTO public.report_counters (year, last_seq) VALUES (yr, 1)
      ON CONFLICT (year) DO UPDATE SET last_seq = report_counters.last_seq + 1
      RETURNING last_seq INTO next_seq;
    NEW.evidencioni_broj := 'KVR-' || yr || '-' || lpad(next_seq::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_failure_reports_ev_broj
  BEFORE INSERT ON public.failure_reports
  FOR EACH ROW EXECUTE FUNCTION public.generate_evidencioni_broj();

CREATE INDEX idx_failure_reports_user_id ON public.failure_reports(user_id);
CREATE INDEX idx_failure_reports_status ON public.failure_reports(status);
