-- SQL Migrations for LudoPollas: Dinero Flexible y Apuestas Especiales
-- Ejecuta este script en el SQL Editor de Supabase para actualizar la base de datos.

-- 1. AGREGAR COLUMNAS A LA TABLA DE PARTIDOS (matches)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS min_bet NUMERIC DEFAULT 2000 NOT NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS max_bet NUMERIC DEFAULT 50000 NOT NULL;

-- 2. AGREGAR COLUMNAS A LA TABLA DE PRONÓSTICOS (predictions)
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS bet_amount NUMERIC DEFAULT 2000 NOT NULL;
ALTER TABLE public.predictions ADD COLUMN IF NOT EXISTS gain NUMERIC DEFAULT 0 NOT NULL;

-- 3. CREAR TABLA DE APUESTAS ESPECIALES (custom_bets)
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

-- 4. CREAR TABLA DE PRONÓSTICOS DE APUESTAS ESPECIALES (custom_bet_predictions)
CREATE TABLE IF NOT EXISTS public.custom_bet_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    custom_bet_id UUID REFERENCES public.custom_bets(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    prediction_value TEXT NOT NULL,
    bet_amount NUMERIC NOT NULL,
    gain NUMERIC DEFAULT 0 NOT NULL,
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

-- 5. ACTUALIZAR TRIGGER DE CÁLCULO DE PUNTOS Y GANANCIAS EN PARTIDOS
CREATE OR REPLACE FUNCTION public.calculate_match_points()
RETURNS trigger AS $$
DECLARE
  total_pool NUMERIC;
  winning_pool NUMERIC;
  max_points INTEGER;
BEGIN
  -- Solo se ejecuta si el partido cambia a 'finished' y tiene marcadores reales establecidos
  IF NEW.status = 'finished' AND NEW.score_a IS NOT NULL AND NEW.score_b IS NOT NULL THEN
    
    -- A. Actualizar los puntos de todos los pronósticos para este partido
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

    -- B. CALCULAR GANANCIAS DE BOLSA MUTUA
    
    -- Obtener el pozo total apostado en este partido
    SELECT COALESCE(SUM(bet_amount), 0) INTO total_pool
    FROM public.predictions
    WHERE match_id = NEW.id;

    -- Encontrar el puntaje máximo obtenido por los participantes de este partido
    SELECT COALESCE(MAX(points_earned), 0) INTO max_points
    FROM public.predictions
    WHERE match_id = NEW.id;

    IF max_points = 0 THEN
      -- Si nadie obtuvo puntos, se devuelve la apuesta (gain = bet_amount)
      UPDATE public.predictions
      SET gain = bet_amount
      WHERE match_id = NEW.id;
    ELSE
      -- Calcular el dinero total apostado por los ganadores (los que obtuvieron el puntaje máximo)
      SELECT COALESCE(SUM(bet_amount), 0) INTO winning_pool
      FROM public.predictions
      WHERE match_id = NEW.id AND points_earned = max_points;

      -- Repartir la bolsa proporcionalmente a los ganadores
      UPDATE public.predictions
      SET gain = CASE
        WHEN points_earned = max_points THEN (bet_amount / winning_pool) * total_pool
        ELSE 0
      END
      WHERE match_id = NEW.id;
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. CREAR TRIGGER Y FUNCIÓN PARA LIQUIDAR APUESTAS ESPECIALES (Bolsa Mutua)
CREATE OR REPLACE FUNCTION public.resolve_custom_bet_gains()
RETURNS trigger AS $$
DECLARE
  total_pool NUMERIC;
  winning_pool NUMERIC;
BEGIN
  -- Se ejecuta si se establece un resultado real (resolved_result) y cambia de nulo a no nulo
  IF NEW.resolved_result IS NOT NULL AND (OLD.resolved_result IS NULL OR OLD.resolved_result = '') THEN
    
    -- A. Calcular pozo total apostado en esta apuesta especial
    SELECT COALESCE(SUM(bet_amount), 0) INTO total_pool
    FROM public.custom_bet_predictions
    WHERE custom_bet_id = NEW.id;

    -- B. Calcular la suma de apuestas del resultado ganador (ignorando mayúsculas/minúsculas y espacios)
    SELECT COALESCE(SUM(bet_amount), 0) INTO winning_pool
    FROM public.custom_bet_predictions
    WHERE custom_bet_id = NEW.id AND TRIM(LOWER(prediction_value)) = TRIM(LOWER(NEW.resolved_result));

    IF winning_pool = 0 THEN
      -- Si nadie acertó el resultado ganador, se devuelve el dinero a todos
      UPDATE public.custom_bet_predictions
      SET gain = bet_amount
      WHERE custom_bet_id = NEW.id;
    ELSE
      -- Repartir bolsa proporcionalmente a los que acertaron
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
