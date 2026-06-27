import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import { Trophy, Mail, Lock, User, LogIn, UserPlus, Building } from 'lucide-react';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('Administración');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isForgotPassword) {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/`,
        });
        if (resetError) throw resetError;
        setResetSent(true);
      } else if (isRegister) {
        if (!displayName.trim()) {
          throw new Error('Por favor ingresa un nombre para mostrar.');
        }
        await signUp(email, password, displayName, department);
        alert('Registro exitoso. Si es necesario, verifica tu correo. Ya puedes iniciar sesión.');
        setIsRegister(false);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="glass-container auth-card">
        <div className="auth-header">
          <h1 className="auth-logo">
            <Trophy size={36} style={{ color: '#fbbf24' }} />
            Interfrigo Pollas
          </h1>
          <p className="auth-subtitle">
            {isForgotPassword 
              ? 'Restablece la contraseña de tu cuenta' 
              : isRegister 
                ? 'Regístrate para competir en las pollas de la empresa' 
                : 'Inicia sesión para ver partidos y hacer tus apuestas'}
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#f87171',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '0.9rem',
            textAlign: 'left'
          }}>
            {error}
          </div>
        )}

        {isForgotPassword && resetSent ? (
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--primary)', padding: '15px', borderRadius: '8px', fontSize: '0.95rem' }}>
              📩 ¡Enlace de recuperación enviado! Revisa tu correo y sigue las instrucciones para cambiar tu contraseña.
            </div>
            <button 
              className="btn btn-secondary"
              onClick={() => {
                setIsForgotPassword(false);
                setResetSent(false);
                setEmail('');
              }}
            >
              Volver a Iniciar Sesión
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {isForgotPassword ? (
              <div className="form-group">
                <label className="form-label">Correo Registrado</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: '#9ca3af' }} />
                  <input
                    type="email"
                    className="form-input"
                    style={{ paddingLeft: '42px' }}
                    placeholder="juan@interfrigo.com.co"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            ) : (
              <>
                {isRegister && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Nombre Completo / Apodo</label>
                      <div style={{ position: 'relative' }}>
                        <User size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: '#9ca3af' }} />
                        <input
                          type="text"
                          className="form-input"
                          style={{ paddingLeft: '42px' }}
                          placeholder="Ej. Juan Pérez"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Área / Departamento</label>
                      <div style={{ position: 'relative' }}>
                        <Building size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: '#9ca3af' }} />
                        <select
                          className="form-input"
                          style={{ paddingLeft: '42px', appearance: 'none', WebkitAppearance: 'none' }}
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          required
                        >
                          <option value="Administración">Administración</option>
                          <option value="TI">Tecnología (TI)</option>
                          <option value="Ventas">Ventas y Comercial</option>
                          <option value="Logística">Logística / Bodega</option>
                          <option value="Finanzas">Finanzas / Contabilidad</option>
                          <option value="Operaciones">Operaciones / Planta</option>
                          <option value="Otros">Otros</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Correo Corporativo / Personal</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: '#9ca3af' }} />
                    <input
                      type="email"
                      className="form-input"
                      style={{ paddingLeft: '42px' }}
                      placeholder="juan@interfrigo.com.co"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">Contraseña</label>
                    {!isRegister && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setError('');
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '0.8rem', cursor: 'pointer', marginBottom: '8px' }}
                      >
                        ¿La olvidaste?
                      </button>
                    )}
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Lock size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: '#9ca3af' }} />
                    <input
                      type="password"
                      className="form-input"
                      style={{ paddingLeft: '42px' }}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '10px' }}>
              {loading ? (
                'Cargando...'
              ) : isForgotPassword ? (
                'Enviar Enlace'
              ) : isRegister ? (
                <>
                  <UserPlus size={18} /> Registrarme
                </>
              ) : (
                <>
                  <LogIn size={18} /> Entrar
                </>
              )}
            </button>
          </form>
        )}

        <div style={{ marginTop: '25px', fontSize: '0.9rem', color: '#9ca3af' }}>
          {isForgotPassword ? (
            <button 
              onClick={() => {
                setIsForgotPassword(false);
                setError('');
              }} 
              style={{ background: 'transparent', border: 'none', color: '#10b981', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Regresar al Inicio de Sesión
            </button>
          ) : isRegister ? (
            <p>
              ¿Ya tienes una cuenta?{' '}
              <button 
                onClick={() => {
                  setIsRegister(false);
                  setError('');
                }} 
                style={{ background: 'transparent', border: 'none', color: '#10b981', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Inicia Sesión
              </button>
            </p>
          ) : (
            <p>
              ¿No tienes una cuenta aún?{' '}
              <button 
                onClick={() => {
                  setIsRegister(true);
                  setError('');
                }} 
                style={{ background: 'transparent', border: 'none', color: '#10b981', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Regístrate aquí
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
