import React, { useState } from 'react';
import { AuthProvider, useAuth, isSupabaseConfigured } from './AuthContext';
import AuthScreen from './components/AuthScreen';
import Dashboard from './components/Dashboard';
import PoolDetail from './components/PoolDetail';
import AdminPanel from './components/AdminPanel';
import { Trophy, LogOut, ShieldAlert, LayoutDashboard, Database, AlertTriangle, ArrowRight } from 'lucide-react';

function SupabaseConfigWarning() {
  return (
    <div className="auth-wrapper" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-container auth-card" style={{ maxWidth: '520px', textAlign: 'left', padding: '35px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '50px',
            height: '50px',
            borderRadius: '12px',
            background: 'rgba(251, 191, 36, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fbbf24'
          }}>
            <AlertTriangle size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>¡Casi Listo! Conecta Supabase</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Configuración de base de datos requerida</p>
          </div>
        </div>

        <p style={{ fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '20px' }}>
          Para que la aplicación funcione y puedas registrarte, iniciar sesión y guardar apuestas, necesitas conectar tu base de datos gratuita de Supabase.
        </p>

        <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', marginBottom: '20px', fontSize: '0.9rem' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '10px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Database size={16} style={{ color: 'var(--primary)' }} /> Pasos para configurar en local:
          </h3>
          <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)' }}>
            <li>
              Crea un proyecto gratis en <a href="https://supabase.com" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Supabase.com</a>.
            </li>
            <li>
              Crea un archivo llamado <strong><code>.env</code></strong> en la carpeta raíz de este proyecto: <br />
              <code style={{ fontSize: '0.8rem', color: '#60a5fa' }}>C:\Users\User\.gemini\antigravity\scratch\ludo-pollas\.env</code>
            </li>
            <li>
              Copia y pega las siguientes variables en tu archivo <strong><code>.env</code></strong> con las claves de tu proyecto:
              <pre style={{ 
                background: 'black', 
                padding: '10px', 
                borderRadius: '6px', 
                fontSize: '0.75rem', 
                color: '#34d399', 
                marginTop: '6px', 
                overflowX: 'auto',
                fontFamily: 'monospace' 
              }}>
{`VITE_SUPABASE_URL=https://tu-id-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon-publica`}
              </pre>
            </li>
            <li>
              Guarda el archivo. ¡Esta página se recargará automáticamente!
            </li>
          </ol>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <span>Encontrarás las instrucciones detalladas de base de datos en:</span>
          <a href="file:///C:/Users/User/.gemini/antigravity/brain/beb83610-ea17-4091-9bbd-baf195bfd865/walkthrough.md" style={{ color: 'var(--primary)', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            walkthrough.md <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, profile, loading, signOut } = useAuth();
  const [selectedPoolId, setSelectedPoolId] = useState(null);
  const [isAdminView, setIsAdminView] = useState(false);

  if (!isSupabaseConfigured) {
    return <SupabaseConfigWarning />;
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '15px',
        color: 'var(--text-muted)'
      }}>
        <Trophy size={48} className="pulse" style={{ color: 'var(--secondary)', animation: 'pulse 1.5s infinite' }} />
        <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Cargando LudoPollas...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div>
      {/* Encabezado */}
      <header className="app-header">
        <div className="header-content">
          <a href="#" className="logo-container" onClick={(e) => {
            e.preventDefault();
            setSelectedPoolId(null);
            setIsAdminView(false);
          }}>
            <Trophy size={26} style={{ color: '#fbbf24' }} />
            LudoPollas
          </a>

          <div className="user-nav">
            {profile?.is_admin && (
              <button 
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  setSelectedPoolId(null);
                  setIsAdminView(!isAdminView);
                }}
              >
                {isAdminView ? (
                  <>
                    <LayoutDashboard size={16} /> Ver Apuestas
                  </>
                ) : (
                  <>
                    <ShieldAlert size={16} /> Administrar
                  </>
                )}
              </button>
            )}

            <div className="user-badge">
              <div className="avatar-circle">
                {profile?.display_name?.substring(0, 2).toUpperCase()}
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }} className="desktop-only">
                {profile?.display_name}
              </span>
            </div>

            <button 
              onClick={signOut}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '8px'
              }}
              title="Cerrar Sesión"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main>
        {selectedPoolId ? (
          <div className="app-main">
            <PoolDetail 
              poolId={selectedPoolId} 
              onBack={() => setSelectedPoolId(null)} 
            />
          </div>
        ) : isAdminView && profile?.is_admin ? (
          <div className="app-main">
            <AdminPanel />
          </div>
        ) : (
          <Dashboard 
            onSelectPool={(poolId) => setSelectedPoolId(poolId)} 
          />
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
