-- Schema Completo para LudoPollas (Consolidado)
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase para tener la base de datos completa con funciones avanzadas.

-- Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA PERFILES DE USUARIOS (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT false,
    department TEXT, -- Área/Departamento de la empresa
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para Profiles
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
    team_a_icon TEXT, -- Emoji, bandera o URL del Equipo A
    team_b_icon TEXT, -- Emoji, bandera o URL del Equipo B
    match_date TIMESTAMP WITH TIME ZONE NOT NULL,
    score_a INTEGER,
    score_b INTEGER,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'finished')),
    min_bet NUMERIC DEFAULT 2000 NOT NULL,
    max_bet NUMERIC DEFAULT 50000 NOT NULL,
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
    bet_amount NUMERIC DEFAULT 2000 NOT NULL,
    gain NUMERIC DEFAULT 0 NOT NULL,
    has_paid BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, match_id)
);

ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- Políticas para Predictions
CREATE POLICY "Permitir lectura de pronósticos a usuarios autenticados" 
    ON public.predictions FOR SELECT 
    USING (auth.role() = 'authenticated');

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

CREATE POLICY "Permitir a administradores actualizar pronósticos" 
    ON public.predictions FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- 6. TABLA DE APUESTAS ESPECIALES (custom_bets)
CREATE TABLE IF NOT EXISTS public.custom_bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    resolved_result TEXT,
    min_bet NUMERIC DEFAULT 2000 NOT NULL,
    max_bet NUMERIC DEFAULT 50000 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.custom_bets ENABLE ROW LEVEL SECURITY;

-- Políticas para custom_bets
CREATE POLICY "Permitir lectura de apuestas especiales a usuarios autenticados" 
    ON public.custom_bets FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir sugerir apuestas especiales a cualquier usuario" 
    ON public.custom_bets FOR INSERT 
    WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Permitir a administradores gestionar apuestas especiales" 
    ON public.custom_bets FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- 7. TABLA DE PRONÓSTICOS DE APUESTAS ESPECIALES (custom_bet_predictions)
CREATE TABLE IF NOT EXISTS public.custom_bet_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    custom_bet_id UUID REFERENCES public.custom_bets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    prediction_value TEXT NOT NULL,
    bet_amount NUMERIC NOT NULL,
    gain NUMERIC DEFAULT 0 NOT NULL,
    has_paid BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (custom_bet_id, user_id)
);

ALTER TABLE public.custom_bet_predictions ENABLE ROW LEVEL SECURITY;

-- Políticas para custom_bet_predictions
CREATE POLICY "Permitir lectura de pronósticos especiales a usuarios autenticados" 
    ON public.custom_bet_predictions FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir apostar en especiales antes de ser resueltas" 
    ON public.custom_bet_predictions FOR INSERT 
    WITH CHECK (
        auth.uid() = user_id AND 
        EXISTS (
            SELECT 1 FROM public.custom_bets 
            WHERE custom_bets.id = custom_bet_id AND custom_bets.status = 'approved' AND custom_bets.resolved_result IS NULL
        )
    );

CREATE POLICY "Permitir actualizar apuesta especial propia" 
    ON public.custom_bet_predictions FOR UPDATE 
    USING (
        auth.uid() = user_id AND 
        EXISTS (
            SELECT 1 FROM public.custom_bets 
            WHERE custom_bets.id = custom_bet_id AND custom_bets.status = 'approved' AND custom_bets.resolved_result IS NULL
        )
    );

CREATE POLICY "Permitir a administradores actualizar pronósticos especiales" 
    ON public.custom_bet_predictions FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() AND profiles.is_admin = true
        )
    );

-- 8. TABLA RETOS 1v1 (p2p_challenges)
CREATE TABLE IF NOT EXISTS public.p2p_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    challenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    challenged_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
    challenger_prediction TEXT NOT NULL CHECK (challenger_prediction IN ('team_a', 'team_b', 'draw')),
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'resolved')),
    winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.p2p_challenges ENABLE ROW LEVEL SECURITY;

-- Políticas para p2p_challenges
CREATE POLICY "Permitir lectura de retos a usuarios autenticados" 
    ON public.p2p_challenges FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir iniciar retos a retadores" 
    ON public.p2p_challenges FOR INSERT 
    WITH CHECK (auth.uid() = challenger_id AND status = 'pending');

CREATE POLICY "Permitir al rival o retador actualizar el estado del reto" 
    ON public.p2p_challenges FOR UPDATE 
    USING (
        auth.uid() = challenged_id OR auth.uid() = challenger_id
    );

-- 9. TRIGGERS Y FUNCIONES AUTOMÁTICAS

-- A. Crear perfil automático al registrarse un usuario en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, is_admin, department)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    COALESCE((new.raw_user_meta_data->>'is_admin')::boolean, false),
    new.raw_user_meta_data->>'department'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- B. Función para calcular puntos de los partidos, bolsa mutua y retos 1v1
CREATE OR REPLACE FUNCTION public.calculate_match_points()
RETURNS trigger AS $$
DECLARE
  total_pool NUMERIC;
  winning_pool NUMERIC;
  max_points INTEGER;
  winning_outcome TEXT;
BEGIN
  -- Solo se ejecuta si el partido cambia a 'finished' y tiene marcadores reales establecidos
  IF NEW.status = 'finished' AND NEW.score_a IS NOT NULL AND NEW.score_b IS NOT NULL THEN
    
    -- 1. Actualizar los puntos de todos los pronósticos para este partido
    UPDATE public.predictions
    SET points_earned = CASE
      -- Marcador exacto: 3 puntos
      WHEN pred_score_a = NEW.score_a AND pred_score_b = NEW.score_b THEN 3
      
      -- Ganador o empate correcto, pero no marcador exacto: 1 punto
      WHEN (pred_score_a > pred_score_b AND NEW.score_a > NEW.score_b) THEN 1
      WHEN (pred_score_a < pred_score_b AND NEW.score_a < NEW.score_b) THEN 1
      WHEN (pred_score_a = pred_score_b AND NEW.score_a = NEW.score_b) THEN 1
      
      -- No acierta: 0 puntos
      ELSE 0
    END
    WHERE match_id = NEW.id;

    -- 2. CALCULAR GANANCIAS DE BOLSA MUTUA
    SELECT COALESCE(SUM(bet_amount), 0) INTO total_pool
    FROM public.predictions
    WHERE match_id = NEW.id;

    SELECT COALESCE(MAX(points_earned), 0) INTO max_points
    FROM public.predictions
    WHERE match_id = NEW.id;

    IF max_points = 0 THEN
      UPDATE public.predictions
      SET gain = bet_amount
      WHERE match_id = NEW.id;
    ELSE
      SELECT COALESCE(SUM(bet_amount), 0) INTO winning_pool
      FROM public.predictions
      WHERE match_id = NEW.id AND points_earned = max_points;

      UPDATE public.predictions
      SET gain = CASE
        WHEN points_earned = max_points THEN (bet_amount / winning_pool) * total_pool
        ELSE 0
      END
      WHERE match_id = NEW.id;
    END IF;

    -- 3. RESOLVER RETOS P2P
    IF NEW.score_a > NEW.score_b THEN
      winning_outcome := 'team_a';
    ELSIF NEW.score_a < NEW.score_b THEN
      winning_outcome := 'team_b';
    ELSE
      winning_outcome := 'draw';
    END IF;

    UPDATE public.p2p_challenges
    SET status = 'resolved',
        winner_id = CASE
          WHEN challenger_prediction = winning_outcome THEN challenger_id
          ELSE challenged_id
        END
    WHERE match_id = NEW.id AND status = 'accepted';

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_match_finished
  AFTER UPDATE OF status, score_a, score_b ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.calculate_match_points();

-- C. Trigger y función para liquidar apuestas especiales (Bolsa Mutua)
CREATE OR REPLACE FUNCTION public.resolve_custom_bet_gains()
RETURNS trigger AS $$
DECLARE
  total_pool NUMERIC;
  winning_pool NUMERIC;
  temp_row RECORD;
BEGIN
  IF NEW.resolved_result IS NOT NULL AND (OLD.resolved_result IS NULL OR OLD.resolved_result = '') THEN
    
    SELECT COALESCE(SUM(bet_amount), 0) INTO total_pool
    FROM public.custom_bet_predictions
    WHERE custom_bet_id = NEW.id;

    SELECT COALESCE(SUM(bet_amount), 0) INTO winning_pool
    FROM public.custom_bet_predictions
    WHERE custom_bet_id = NEW.id AND TRIM(LOWER(prediction_value)) = TRIM(LOWER(NEW.resolved_result));

    IF winning_pool = 0 THEN
      UPDATE public.custom_bet_predictions
      SET gain = bet_amount
      WHERE custom_bet_id = NEW.id;
    ELSE
      UPDATE public.custom_bet_predictions
      SET gain = CASE
        WHEN TRIM(LOWER(prediction_value)) = TRIM(LOWER(NEW.resolved_result)) THEN (bet_amount / winning_pool) * total_pool
        ELSE 0
      END
      WHERE custom_bet_id = NEW.id;
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_custom_bet_resolved
  AFTER UPDATE OF resolved_result ON public.custom_bets
  FOR EACH ROW EXECUTE FUNCTION public.resolve_custom_bet_gains();

-- 10. TABLA CHAT DE BURLAS EN VIVO (chat_messages)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir lectura de mensajes de chat a autenticados" 
    ON public.chat_messages FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir insertar mensajes de chat propios" 
    ON public.chat_messages FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- 11. HABILITAR TIEMPO REAL (REALTIME) PARA EL CHAT Y RETOS
-- Ejecuta esto para activar las notificaciones y mensajes instantáneos sin recargar
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.p2p_challenges;


