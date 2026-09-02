CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  practice_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  total_minutes NUMERIC NOT NULL DEFAULT 0,
  last_practice_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  adavu TEXT NOT NULL,
  grade TEXT NOT NULL DEFAULT '',
  accuracy INTEGER NOT NULL DEFAULT 0,
  duration_seconds NUMERIC NOT NULL DEFAULT 0,
  camera_mode TEXT NOT NULL DEFAULT 'full',
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  mudras TEXT[] NOT NULL DEFAULT '{}',
  mistake_count INTEGER NOT NULL DEFAULT 0,
  feedback TEXT[] NOT NULL DEFAULT '{}',
  performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_sessions TO authenticated;
GRANT ALL ON public.practice_sessions TO service_role;
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_select_own" ON public.practice_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "sessions_insert_own" ON public.practice_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessions_update_own" ON public.practice_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessions_delete_own" ON public.practice_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX practice_sessions_user_time_idx ON public.practice_sessions (user_id, performed_at DESC);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.apply_practice_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d DATE := (NEW.performed_at AT TIME ZONE 'UTC')::date;
  prev DATE;
  cur INTEGER;
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.user_id) ON CONFLICT (id) DO NOTHING;
  SELECT last_practice_date, practice_streak INTO prev, cur FROM public.profiles WHERE id = NEW.user_id;
  IF prev IS NULL THEN
    cur := 1;
  ELSIF d = prev THEN
    cur := GREATEST(cur, 1);
  ELSIF d = prev + 1 THEN
    cur := cur + 1;
  ELSIF d > prev THEN
    cur := 1;
  END IF;
  UPDATE public.profiles
  SET practice_streak = cur,
      longest_streak = GREATEST(longest_streak, cur),
      total_minutes = total_minutes + (NEW.duration_seconds / 60.0),
      last_practice_date = GREATEST(COALESCE(prev, d), d),
      updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_practice_session_created
AFTER INSERT ON public.practice_sessions
FOR EACH ROW EXECUTE FUNCTION public.apply_practice_session();