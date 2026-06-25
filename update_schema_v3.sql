-- SQL Migrations para LudoPollas: Muro de Burlas (Chat en Tiempo Real)
-- Ejecuta este script en el SQL Editor de tu proyecto en Supabase.

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE, -- NULL si es chat general de la empresa
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para el chat
CREATE POLICY "Permitir lectura de mensajes de chat a autenticados" 
    ON public.chat_messages FOR SELECT 
    USING (auth.role() = 'authenticated');

CREATE POLICY "Permitir insertar mensajes de chat propios" 
    ON public.chat_messages FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
