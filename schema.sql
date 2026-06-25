-- SQL Schema for ludo-pollas
-- Puedes ejecutar este script en la sección SQL Editor de tu proyecto en Supabase.

-- Habilitar extensión para UUIDs si no está habilitada
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA PERFILES DE USUARIOS (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de Seguridad para Profiles
CREATE POLICY "Permitir lectura pública de perfiles" 
    ON public.profiles FOR SELECT 
    USING (true);

CREATE POLICY "Permitir actualización de perfil propio" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Permitir inserción de perfil propio" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- 2. TABLA PARTIDOS (matches)
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_a TEXT NOT NULL,
    team_b TEXT NOT NULL,
    match_date TIMESTAMP WITH TIME ZONE NOT NULL,
    score_a INTEGER,
    score_b INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'finished')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Políticas para Matches
CREATE POLICY "Permitir lectura pública de partidos" 
    ON public.matches FOR SELECT 
    USING (true);

CREATE POLICY "Permitir inserción/edición de partidos solo a administradores" 
    ON public.matches FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- 3. TABLA POLLAS (pools)
CREATE TABLE IF NOT EXISTS public.pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    entry_fee NUMERIC DEFAULT 0 NOT NULL,
    invite_code TEXT UNIQUE DEFAULT substring(md5(random()::text) from 1 for 6) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.pools ENABLE ROW LEVEL SECURITY;

-- Políticas para Pools
CREATE POLICY "Permitir lectura de pollas a usuarios autenticados" 
    ON public.pools FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir creación de pollas a usuarios autenticados" 
    ON public.pools FOR INSERT 
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Permitir actualizar polla propia al creador" 
    ON public.pools FOR UPDATE 
    USING (auth.uid() = created_by);

-- 4. TABLA MIEMBROS DE POLLAS (pool_members)
CREATE TABLE IF NOT EXISTS public.pool_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID REFERENCES public.pools(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    has_paid BOOLEAN DEFAULT false NOT NULL,
    UNIQUE (pool_id, user_id)
);

ALTER TABLE public.pool_members ENABLE ROW LEVEL SECURITY;

-- Políticas para Pool Members
CREATE POLICY "Permitir lectura de miembros a usuarios autenticados" 
    ON public.pool_members FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir unirse a pollas" 
    ON public.pool_members FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Permitir salir de pollas a uno mismo" 
    ON public.pool_members FOR DELETE 
    USING (auth.uid() = user_id);

CREATE POLICY "Permitir a administradores o al creador de la polla actualizar el estado de pago" 
    ON public.pool_members FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        ) OR EXISTS (
            SELECT 1 FROM public.pools 
            WHERE pools.id = pool_members.pool_id AND pools.created_by = auth.uid()
        )
    );

-- 5. TABLA PRONÓSTICOS (predictions)
CREATE TABLE IF NOT EXISTS public.predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
    pred_score_a INTEGER NOT NULL,
    pred_score_b INTEGER NOT NULL,
    points_earned INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, match_id)
);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- Políticas para Predictions
CREATE POLICY "Permitir lectura de pronósticos a usuarios autenticados" 
    ON public.predictions FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Permitir crear o actualizar pronóstico propio, siempre que el partido no haya empezado (esté 'pending')
CREATE POLICY "Permitir ingresar pronósticos propios" 
    ON public.predictions FOR INSERT 
    WITH CHECK (
        auth.uid() = user_id AND 
        EXISTS (
            SELECT 1 FROM public.matches 
            WHERE matches.id = match_id AND matches.status = 'pending' AND matches.match_date > now()
        )
    );

CREATE POLICY "Permitir actualizar pronósticos propios antes del partido" 
    ON public.predictions FOR UPDATE 
    USING (
        auth.uid() = user_id AND 
        EXISTS (
            SELECT 1 FROM public.matches 
            WHERE matches.id = match_id AND matches.status = 'pending' AND matches.match_date > now()
        )
    );

-- 6. TRIGGERS Y FUNCIONES AUTOMÁTICAS

-- A. Crear perfil automático al registrarse un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, is_admin)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    -- El primer usuario registrado o cualquiera con email interfrigo es admin, o definimos por defecto false
    COALESCE((new.raw_user_meta_data->>'is_admin')::boolean, false)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- B. Función para calcular puntos de los pronósticos cuando finaliza un partido
CREATE OR REPLACE FUNCTION public.calculate_match_points()
RETURNS trigger AS $$
BEGIN
  -- Solo se ejecuta si el partido cambia a 'finished' y tiene marcadores reales establecidos
  IF NEW.status = 'finished' AND NEW.score_a IS NOT NULL AND NEW.score_b IS NOT NULL THEN
    
    -- Actualizar los puntos de todos los pronósticos para este partido
    UPDATE public.predictions
    SET points_earned = CASE
      -- Marcador exacto: 3 puntos
      WHEN pred_score_a = NEW.score_a AND pred_score_b = NEW.score_b THEN 3
      
      -- Ganador o empate correcto, pero no marcador exacto: 1 punto
      -- Caso A: Gana Equipo A
      WHEN (pred_score_a > pred_score_b AND NEW.score_a > NEW.score_b) THEN 1
      -- Caso B: Gana Equipo B
      WHEN (pred_score_a < pred_score_b AND NEW.score_a < NEW.score_b) THEN 1
      -- Caso C: Empate
      WHEN (pred_score_a = pred_score_b AND NEW.score_a = NEW.score_b) THEN 1
      
      -- No acierta: 0 puntos
      ELSE 0
    END
    WHERE match_id = NEW.id;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_match_finished
  AFTER UPDATE OF status, score_a, score_b ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.calculate_match_points();
