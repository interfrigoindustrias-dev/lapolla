import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validar que no sean vacíos y no sean el texto de ejemplo
export const isSupabaseConfigured = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'https://tu-proyecto.supabase.co' &&
  supabaseUrl.startsWith('https://')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
