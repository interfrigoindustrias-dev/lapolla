-- 1. AGREGAR COLUMNAS A PROFILES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance NUMERIC DEFAULT 0 NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nequi_phone TEXT;

-- 2. TABLA CONFIGURACIÓN DE APP
CREATE TABLE IF NOT EXISTS public.app_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    admin_nequi_phone TEXT DEFAULT '3000000000' NOT NULL,
    admin_nequi_qr_url TEXT,
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insertar configuración por defecto
INSERT INTO public.app_settings (id, admin_nequi_phone) VALUES (1, '3000000000') ON CONFLICT (id) DO NOTHING;

-- Habilitar RLS en app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura pública de app_settings" ON public.app_settings;
CREATE POLICY "Permitir lectura pública de app_settings" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir actualizar app_settings solo a admins" ON public.app_settings;
CREATE POLICY "Permitir actualizar app_settings solo a admins" ON public.app_settings FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 3. TABLA DE TRANSACCIONES DE BILLETERA
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'bet_placed', 'bet_won', 'bet_refund', 'p2p_placed', 'p2p_win', 'p2p_refund')),
    amount NUMERIC NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    receipt_url TEXT, -- Captura de pantalla de Nequi o referencia
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS en wallet_transactions
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir a usuarios ver sus propias transacciones" ON public.wallet_transactions;
CREATE POLICY "Permitir a usuarios ver sus propias transacciones" ON public.wallet_transactions FOR SELECT USING (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

DROP POLICY IF EXISTS "Permitir a usuarios insertar depósitos y retiros propios" ON public.wallet_transactions;
CREATE POLICY "Permitir a usuarios insertar depósitos y retiros propios" ON public.wallet_transactions FOR INSERT WITH CHECK (
    auth.uid() = user_id AND type IN ('deposit', 'withdrawal') AND status = 'pending'
);

DROP POLICY IF EXISTS "Permitir a administradores actualizar transacciones" ON public.wallet_transactions;
CREATE POLICY "Permitir a administradores actualizar transacciones" ON public.wallet_transactions FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
);

-- 4. FUNCIÓN Y TRIGGER PARA PROCESAR DEPÓSITOS Y RETIROS MANUALES
CREATE OR REPLACE FUNCTION public.process_wallet_transaction()
RETURNS trigger AS $$
BEGIN
  -- A. Depósito aprobado
  IF NEW.type = 'deposit' AND NEW.status = 'approved' AND OLD.status = 'pending' THEN
    UPDATE public.profiles
    SET balance = balance + NEW.amount
    WHERE id = NEW.user_id;
  END IF;

  -- B. Retiro solicitado (se pone en pending, descontamos el saldo inmediatamente de forma preventiva)
  IF TG_OP = 'INSERT' AND NEW.type = 'withdrawal' THEN
    -- Validar saldo
    IF (SELECT balance FROM public.profiles WHERE id = NEW.user_id) < NEW.amount THEN
      RAISE EXCEPTION 'Saldo insuficiente para solicitar este retiro.';
    END IF;

    UPDATE public.profiles
    SET balance = balance - NEW.amount
    WHERE id = NEW.user_id;
  END IF;

  -- C. Retiro rechazado (devolvemos el dinero descontado preventivamente)
  IF NEW.type = 'withdrawal' AND NEW.status = 'rejected' AND OLD.status = 'pending' THEN
    UPDATE public.profiles
    SET balance = balance + NEW.amount
    WHERE id = NEW.user_id;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_wallet_transaction_change ON public.wallet_transactions;
CREATE TRIGGER on_wallet_transaction_change
  BEFORE INSERT OR UPDATE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.process_wallet_transaction();


-- 5. TRIGGER PARA DESCONTAR/DEVOLVER DINERO EN APUESTAS DE PARTIDOS (predictions)
CREATE OR REPLACE FUNCTION public.process_match_bet_balance()
RETURNS trigger AS $$
DECLARE
  current_balance NUMERIC;
  diff NUMERIC;
BEGIN
  -- A. Nueva apuesta
  IF TG_OP = 'INSERT' THEN
    SELECT balance INTO current_balance FROM public.profiles WHERE id = NEW.user_id;
    IF current_balance < NEW.bet_amount THEN
      RAISE EXCEPTION 'Saldo insuficiente en tu billetera. Recarga por Nequi para apostar.';
    END IF;

    -- Descontar saldo
    UPDATE public.profiles SET balance = balance - NEW.bet_amount WHERE id = NEW.user_id;

    -- Insertar transacción
    INSERT INTO public.wallet_transactions (user_id, type, amount, status, details)
    VALUES (NEW.user_id, 'bet_placed', NEW.bet_amount, 'completed', 'Apuesta de partido');
  END IF;

  -- B. Actualización de apuesta (cambio en el monto apostado)
  IF TG_OP = 'UPDATE' THEN
    diff := NEW.bet_amount - OLD.bet_amount;
    IF diff > 0 THEN
      SELECT balance INTO current_balance FROM public.profiles WHERE id = NEW.user_id;
      IF current_balance < diff THEN
        RAISE EXCEPTION 'Saldo insuficiente para incrementar tu apuesta. Diferencia: $%', diff;
      END IF;

      UPDATE public.profiles SET balance = balance - diff WHERE id = NEW.user_id;
      
      INSERT INTO public.wallet_transactions (user_id, type, amount, status, details)
      VALUES (NEW.user_id, 'bet_placed', diff, 'completed', 'Aumento de apuesta en partido');
    ELSIF diff < 0 THEN
      -- Se redujo el monto de apuesta, devolvemos la diferencia
      UPDATE public.profiles SET balance = balance + ABS(diff) WHERE id = NEW.user_id;

      INSERT INTO public.wallet_transactions (user_id, type, amount, status, details)
      VALUES (NEW.user_id, 'bet_refund', ABS(diff), 'completed', 'Reembolso por ajuste de apuesta');
    END IF;

    -- C. Registro de ganancia (el trigger original calcula gain y actualiza la fila)
    IF NEW.gain IS NOT NULL AND (OLD.gain IS NULL OR OLD.gain != NEW.gain) AND NEW.gain > 0 THEN
      UPDATE public.profiles SET balance = balance + NEW.gain WHERE id = NEW.user_id;

      INSERT INTO public.wallet_transactions (user_id, type, amount, status, details)
      VALUES (NEW.user_id, 'bet_won', NEW.gain, 'completed', 'Ganancia obtenida en partido');
    END IF;
  END IF;

  -- C. Eliminación de apuesta (si se permite)
  IF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET balance = balance + OLD.bet_amount WHERE id = OLD.user_id;

    INSERT INTO public.wallet_transactions (user_id, type, amount, status, details)
    VALUES (OLD.user_id, 'bet_refund', OLD.bet_amount, 'completed', 'Reembolso por cancelación de apuesta');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_match_bet_change ON public.predictions;
CREATE TRIGGER on_match_bet_change
  AFTER INSERT OR UPDATE OR DELETE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.process_match_bet_balance();


-- 6. TRIGGER PARA DESCONTAR/DEVOLVER DINERO EN APUESTAS ESPECIALES (custom_bet_predictions)
CREATE OR REPLACE FUNCTION public.process_custom_bet_balance()
RETURNS trigger AS $$
DECLARE
  current_balance NUMERIC;
  diff NUMERIC;
BEGIN
  -- A. Nueva apuesta especial
  IF TG_OP = 'INSERT' THEN
    SELECT balance INTO current_balance FROM public.profiles WHERE id = NEW.user_id;
    IF current_balance < NEW.bet_amount THEN
      RAISE EXCEPTION 'Saldo insuficiente. Recarga por Nequi para poder apostar.';
    END IF;

    UPDATE public.profiles SET balance = balance - NEW.bet_amount WHERE id = NEW.user_id;

    INSERT INTO public.wallet_transactions (user_id, type, amount, status, details)
    VALUES (NEW.user_id, 'bet_placed', NEW.bet_amount, 'completed', 'Apuesta especial');
  END IF;

  -- B. Actualización o Ganancia
  IF TG_OP = 'UPDATE' THEN
    -- Registro de ganancia
    IF NEW.gain IS NOT NULL AND (OLD.gain IS NULL OR OLD.gain != NEW.gain) AND NEW.gain > 0 THEN
      UPDATE public.profiles SET balance = balance + NEW.gain WHERE id = NEW.user_id;

      INSERT INTO public.wallet_transactions (user_id, type, amount, status, details)
      VALUES (NEW.user_id, 'bet_won', NEW.gain, 'completed', 'Ganancia en apuesta especial');
    END IF;
  END IF;

  -- C. Eliminación
  IF TG_OP = 'DELETE' THEN
    UPDATE public.profiles SET balance = balance + OLD.bet_amount WHERE id = OLD.user_id;

    INSERT INTO public.wallet_transactions (user_id, type, amount, status, details)
    VALUES (OLD.user_id, 'bet_refund', OLD.bet_amount, 'completed', 'Reembolso por cancelación de apuesta especial');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_custom_bet_change ON public.custom_bet_predictions;
CREATE TRIGGER on_custom_bet_change
  AFTER INSERT OR UPDATE OR DELETE ON public.custom_bet_predictions
  FOR EACH ROW EXECUTE FUNCTION public.process_custom_bet_balance();


-- 7. TRIGGER PARA RETOS 1v1 P2P
CREATE OR REPLACE FUNCTION public.process_p2p_balance()
RETURNS trigger AS $$
DECLARE
  challenger_bal NUMERIC;
  challenged_bal NUMERIC;
BEGIN
  -- A. Cuando el reto se Acepta: debitamos el saldo a ambos
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    SELECT balance INTO challenger_bal FROM public.profiles WHERE id = NEW.challenger_id;
    SELECT balance INTO challenged_bal FROM public.profiles WHERE id = NEW.challenged_id;

    IF challenger_bal < NEW.amount THEN
      RAISE EXCEPTION 'El retador ya no cuenta con saldo suficiente en su billetera.';
    END IF;
    IF challenged_bal < NEW.amount THEN
      RAISE EXCEPTION 'Saldo insuficiente. Recarga por Nequi para poder aceptar este duelo.';
    END IF;

    -- Descontar a ambos
    UPDATE public.profiles SET balance = balance - NEW.amount WHERE id = NEW.challenger_id;
    UPDATE public.profiles SET balance = balance - NEW.amount WHERE id = NEW.challenged_id;

    -- Registrar transacciones
    INSERT INTO public.wallet_transactions (user_id, type, amount, status, details)
    VALUES (NEW.challenger_id, 'p2p_placed', NEW.amount, 'completed', 'Duelo 1v1 Aceptado');
    INSERT INTO public.wallet_transactions (user_id, type, amount, status, details)
    VALUES (NEW.challenged_id, 'p2p_placed', NEW.amount, 'completed', 'Duelo 1v1 Aceptado');
  END IF;

  -- B. Cuando el reto se Resuelve (estado 'resolved'): acreditamos el pozo doble al ganador
  IF NEW.status = 'resolved' AND OLD.status = 'accepted' AND NEW.winner_id IS NOT NULL THEN
    -- Ganancia es monto * 2
    UPDATE public.profiles SET balance = balance + (NEW.amount * 2) WHERE id = NEW.winner_id;

    INSERT INTO public.wallet_transactions (user_id, type, amount, status, details)
    VALUES (NEW.winner_id, 'p2p_win', NEW.amount * 2, 'completed', 'Ganador del duelo 1v1');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_p2p_challenge_balance_change ON public.p2p_challenges;
CREATE TRIGGER on_p2p_challenge_balance_change
  AFTER UPDATE OF status ON public.p2p_challenges
  FOR EACH ROW EXECUTE FUNCTION public.process_p2p_balance();
