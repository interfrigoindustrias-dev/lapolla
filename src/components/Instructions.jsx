import React, { useState } from 'react';
import { BookOpen, Trophy, ShieldAlert, DollarSign, Calendar, MessageSquare, Zap, Sparkles, HelpCircle } from 'lucide-react';

export default function Instructions({ isAdmin }) {
  const [activeTab, setActiveTab] = useState('user'); // user | admin

  return (
    <div className="glass-container" style={{ padding: '24px', width: '100%', gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <BookOpen size={28} style={{ color: 'var(--primary)' }} />
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Guía de Uso de LudoPollas</h1>
      </div>

      {/* Tabs instructivo */}
      <div className="tabs" style={{ marginBottom: '20px' }}>
        <button 
          className={`tab ${activeTab === 'user' ? 'active' : ''}`}
          onClick={() => setActiveTab('user')}
        >
          <Trophy size={16} style={{ marginRight: '6px', display: 'inline-flex', verticalAlign: 'middle' }} />
          Guía del Apostador (Usuario)
        </button>
        {isAdmin && (
          <button 
            className={`tab ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            <ShieldAlert size={16} style={{ marginRight: '6px', display: 'inline-flex', verticalAlign: 'middle' }} />
            Guía del Administrador (Admin)
          </button>
        )}
      </div>

      {/* CONTENIDO USUARIO */}
      {activeTab === 'user' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} style={{ color: 'var(--primary)' }} /> 1. Pronósticos y Apuestas de Partidos
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6' }}>
              En la pestaña <strong>Partidos y Apuestas</strong> verás los juegos programados. Para jugar, ingresa tu marcador pronosticado (Goles Equipo A y Goles Equipo B) y el monto de dinero que deseas apostar (debe estar dentro de los límites mínimo y máximo permitidos por el partido). Haz clic en <strong>Apostar</strong> para registrar tu apuesta. Puedes modificar tu apuesta las veces que quieras antes del inicio del encuentro.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={18} style={{ color: 'var(--secondary)' }} /> 2. Ganancias y Bolsa Mutua (Pari-mutuel)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '8px' }}>
              Todo el dinero apostado por los compañeros para un partido forma un **pozo o bolsa total**. Al finalizar el encuentro, la bolsa completa se distribuye proporcionalmente entre los usuarios que obtuvieron el mayor puntaje en el partido:
            </p>
            <ul style={{ paddingLeft: '20px', color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li><strong>Exacto (3 pts)</strong>: Si acertaste el marcador exacto, te llevas tu parte de la bolsa.</li>
              <li><strong>Ganador / Empate (1 pt)</strong>: Si nadie acierta el marcador exacto, la bolsa se reparte entre quienes acertaron quién ganaba o si empataban.</li>
              <li><strong>Sin aciertos</strong>: Si nadie en la empresa acierta nada del partido, se devuelve el dinero apostado a todos.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} style={{ color: 'var(--accent-blue)' }} /> 3. Retos Directos 1v1 (Duelos en la Oficina)
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6' }}>
              ¿Quieres desafiar a un compañero en específico? En la pestaña de <strong>Apuestas Especiales</strong>, ve a la sección de **Duelos 1v1**. Selecciona a tu rival, escoge el partido, indica tu predicción (gana local, gana visitante o empate) e ingresa el monto de dinero. Tu compañero recibirá el reto y tendrá la opción de Aceptarlo o Rechazarlo. Al terminar el partido, el dinero del perdedor se transfiere al ganador automáticamente.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: '#ec4899' }} /> 4. Apuestas Especiales y Ligas
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6' }}>
              Sugiere ideas de apuestas chistosas o específicas en la oficina (ej: *¿Carlos llegará tarde mañana?*). Si el admin la aprueba, se abre la bolsa y todos pueden apostar. Además, compite con otros departamentos en la **Tabla General**: ¿Quién sabe más de fútbol, TI o Finanzas?
            </p>
          </div>

        </div>
      )}

      {/* CONTENIDO ADMINISTRADOR */}
      {activeTab === 'admin' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} style={{ color: 'var(--primary)' }} /> 1. Gestión de Partidos y Límites
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6' }}>
              Desde tu pestaña de **Administración** puedes agregar nuevos partidos. Configura un valor de **Apuesta Mínima** y **Apuesta Máxima** para controlar que los usuarios no arriesguen más dinero de lo acordado en la empresa. Cambia el estado del partido a **En Vivo** cuando empiece y a **Finalizado** cuando termine. Al marcarlo como finalizado, ingresa el marcador real para calcular puntos y repartir dinero.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: 'var(--secondary)' }} /> 2. Moderación de Apuestas Especiales
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6' }}>
              Los empleados te enviarán sugerencias de apuestas divertidas. Ve a **Administrar** &gt; **Apuestas Especiales** para ver la lista de pendientes. Haz clic en **Aprobar** para habilitarla en el Dashboard de todos, o **Rechazar** para descartarla. Una vez ocurra el evento, escribe el resultado ganador en el panel para repartir la bolsa mutua asociada.
            </p>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HelpCircle size={18} style={{ color: 'var(--accent-blue)' }} /> 3. Control de Caja y Saldos de Cobro
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6' }}>
              Dado que la aplicación maneja el registro del dinero pero no realiza transacciones de pasarela de pago (para mantener el servicio 100% gratuito), el pago de la inscripción de las pollas privadas o el dinero de los partidos se recauda de forma externa (físicamente, transferencia directa, etc.). 
              Utiliza el listado de miembros de la polla privada para marcar quién ya ha pagado físicamente (**Pagado**) y quién está pendiente. La aplicación calculará los saldos acumulados de ganancias transparentemente para que sepas a quién cobrarle y a quién entregarle premios.
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
