import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // 1. Obtener la sesión activa actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Escuchar cambios en el estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId) => {
    if (!isSupabaseConfigured) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error cargando el perfil:', error);
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Error inesperado en perfil:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user && isSupabaseConfigured) {
      await fetchProfile(user.id);
    }
  };

  const signUp = async (email, password, displayName, department) => {
    if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          department: department
        }
      }
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email, password) => {
    if (!isSupabaseConfigured) throw new Error('Supabase no está configurado.');
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
export { isSupabaseConfigured };
