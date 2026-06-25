import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { Calendar, PlusCircle, Trash2, ShieldCheck, Trophy, Sparkles, CheckCircle2, XCircle } from 'lucide-react';

export default function AdminPanel() {
  const { profile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('matches'); // matches | custom_bets
  
  // Estados para Partidos
  const [matches, setMatches] = useState([]);
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [minBet, setMinBet] = useState('2000');
  const [maxBet, setMaxBet] = useState('50000');
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState({}); // { [matchId]: { scoreA, scoreB, status } }

  // Estados para Apuestas Especiales
  const [customBets, setCustomBets] = useState([]);
  const [resolvingResults, setResolvingResults] = useState({}); // { [betId]: resultText }

  useEffect(() => {
    if (profile?.is_admin) {
      if (activeSubTab === 'matches') {
        fetchMatches();
      } else {
        fetchCustomBets();
      }
    }
  }, [profile, activeSubTab]);

  const fetchMatches = async () => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('match_date', { ascending: true });

    if (error) {
      console.error('Error cargando partidos en admin:', error);
    } else {
      setMatches(data || []);
      const scoreMap = {};
      data?.forEach(m => {
        scoreMap[m.id] = {
          scoreA: m.score_a ?? '',
          scoreB: m.score_b ?? '',
          status: m.status
        };
      });
      setScores(scoreMap);
    }
  };

  const fetchCustomBets = async () => {
    const { data, error } = await supabase
      .from('custom_bets')
      .select(`
        *,
        profiles:user_id (display_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error cargando especiales en admin:', error);
    } else {
      setCustomBets(data || []);
    }
  };

  const handleAddMatch = async (e) => {
    e.preventDefault();
    if (!teamA.trim() || !teamB.trim() || !matchDate) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('matches')
        .insert({
          team_a: teamA.trim(),
          team_b: teamB.trim(),
          match_date: new Date(matchDate).toISOString(),
          min_bet: parseFloat(minBet) || 2000,
          max_bet: parseFloat(maxBet) || 50000,
          status: 'pending'
        });

      if (error) throw error;

      setTeamA('');
      setTeamB('');
      setMatchDate('');
      setMinBet('2000');
      setMaxBet('50000');
      fetchMatches();
      alert('Partido agregado con éxito.');
    } catch (err) {
      alert('Error agregando partido: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (matchId, team, val) => {
    const cleanVal = val === '' ? '' : parseInt(val, 10);
    if (cleanVal !== '' && isNaN(cleanVal)) return;

    setScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team === 'A' ? 'scoreA' : 'scoreB']: cleanVal
      }
    }));
  };

  const handleStatusChange = (matchId, val) => {
    setScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        status: val
      }
    }));
  };

  const handleUpdateMatch = async (matchId) => {
    const s = scores[matchId];
    const scoreA = s.scoreA === '' ? null : s.scoreA;
    const scoreB = s.scoreB === '' ? null : s.scoreB;
    const status = s.status;

    if (status === 'finished' && (scoreA === null || scoreB === null)) {
      alert('Para finalizar un partido debes ingresar un marcador real.');
      return;
    }

    try {
      const { error } = await supabase
        .from('matches')
        .update({
          score_a: scoreA,
          score_b: scoreB,
          status: status
        })
        .eq('id', matchId);

      if (error) throw error;
      
      fetchMatches();
      alert('Partido actualizado con éxito. Las ganancias y puntos fueron calculados automáticamente.');
    } catch (err) {
      alert('Error al actualizar el partido: ' + (err.message || err));
    }
  };

  const handleDeleteMatch = async (matchId) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este partido? Se borrarán todos los pronósticos y apuestas.')) return;

    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);

      if (error) throw error;
      fetchMatches();
      alert('Partido eliminado.');
    } catch (err) {
      alert('Error eliminando partido: ' + (err.message || err));
    }
  };

  // ACCIONES APUESTAS ESPECIALES
  const handleApproveBet = async (betId) => {
    try {
      const { error } = await supabase
        .from('custom_bets')
        .update({ status: 'approved' })
        .eq('id', betId);

      if (error) throw error;
      fetchCustomBets();
      alert('Apuesta sugerida aprobada y abierta para el público.');
    } catch (err) {
      alert('Error al aprobar: ' + err.message);
    }
  };

  const handleRejectBet = async (betId) => {
    try {
      const { error } = await supabase
        .from('custom_bets')
        .update({ status: 'rejected' })
        .eq('id', betId);

      if (error) throw error;
      fetchCustomBets();
      alert('Apuesta sugerida rechazada.');
    } catch (err) {
      alert('Error al rechazar: ' + err.message);
    }
  };

  const handleResolveBet = async (betId) => {
    const resultVal = resolvingResults[betId]?.trim();
    if (!resultVal) {
      alert('Por favor escribe el resultado ganador para liquidar la apuesta.');
      return;
    }

    if (!confirm(`¿Estás seguro de que el resultado ganador es "${resultVal}"? Se repartirá la bolsa mutua ahora mismo.`)) return;

    try {
      const { error } = await supabase
        .from('custom_bets')
        .update({ resolved_result: resultVal })
        .eq('id', betId);

      if (error) throw error;
      
      fetchCustomBets();
      alert('Apuesta especial resuelta y bolsa repartida con éxito.');
    } catch (err) {
      alert('Error resolviendo apuesta: ' + err.message);
    }
  };

  if (!profile?.is_admin) {
    return (
      <div className="glass-container empty-state" style={{ gridColumn: '1 / -1' }}>
        <p>No tienes permisos de administrador para ver esta sección.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={28} style={{ color: 'var(--primary)' }} />
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Panel de Administración</h1>
        </div>

        {/* Sub-Tabs de Admin */}
        <div className="tabs" style={{ marginBottom: 0, width: 'auto', flex: 'none' }}>
          <button 
            className={`tab ${activeSubTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('matches')}
            style={{ padding: '8px 16px' }}
          >
            <Calendar size={16} style={{ marginRight: '6px', display: 'inline-flex', verticalAlign: 'middle' }} />
            Partidos
          </button>
          <button 
            className={`tab ${activeSubTab === 'custom_bets' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('custom_bets')}
            style={{ padding: '8px 16px' }}
          >
            <Sparkles size={16} style={{ marginRight: '6px', display: 'inline-flex', verticalAlign: 'middle' }} />
            Apuestas Especiales
          </button>
        </div>
      </div>

      {/* VISTA PARTIDOS */}
      {activeSubTab === 'matches' && (
        <div className="admin-grid">
          {/* Formulario Agregar Partido */}
          <div className="glass-container admin-match-form">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PlusCircle style={{ color: 'var(--primary)' }} /> Agregar Nuevo Partido
            </h2>

            <form onSubmit={handleAddMatch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Equipo A</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej. Colombia"
                  value={teamA}
                  onChange={(e) => setTeamA(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Equipo B</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej. Inglaterra"
                  value={teamB}
                  onChange={(e) => setTeamB(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Fecha y Hora</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Apuesta Mínima ($)</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  value={minBet}
                  onChange={(e) => setMinBet(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Apuesta Máxima ($)</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  value={maxBet}
                  onChange={(e) => setMaxBet(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={loading} style={{ height: '45px' }}>
                Agregar
              </button>
            </form>
          </div>

          {/* Listado y Carga de Marcadores */}
          <div className="glass-container" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar style={{ color: 'var(--accent-blue)' }} /> Marcadores y Cierre de Partidos
            </h2>

            {matches.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No hay partidos registrados aún.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {matches.map(match => {
                  const s = scores[match.id] || { scoreA: '', scoreB: '', status: 'pending' };
                  
                  return (
                    <div 
                      key={match.id} 
                      className="glass-container" 
                      style={{ 
                        padding: '16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        flexWrap: 'wrap', 
                        gap: '15px',
                        background: 'rgba(255,255,255,0.01)',
                        borderColor: match.status === 'live' ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-color)'
                      }}
                    >
                      <div style={{ flex: '1 1 200px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'white' }}>
                          {match.team_a} vs {match.team_b}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Límites: ${match.min_bet?.toLocaleString()} - ${match.max_bet?.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Fecha: {new Date(match.match_date).toLocaleString('es-CO')}
                        </div>
                      </div>

                      {/* Marcador Real */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="text"
                          maxLength="2"
                          inputMode="numeric"
                          className="prediction-input"
                          style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}
                          value={s.scoreA}
                          onChange={(e) => handleScoreChange(match.id, 'A', e.target.value)}
                          placeholder="-"
                        />
                        <span style={{ color: 'var(--text-muted)' }}>:</span>
                        <input
                          type="text"
                          maxLength="2"
                          inputMode="numeric"
                          className="prediction-input"
                          style={{ width: '40px', height: '40px', fontSize: '1.2rem' }}
                          value={s.scoreB}
                          onChange={(e) => handleScoreChange(match.id, 'B', e.target.value)}
                          placeholder="-"
                        />
                      </div>

                      {/* Estado */}
                      <div>
                        <select
                          className="form-input"
                          style={{ padding: '8px 12px', fontSize: '0.9rem', width: '130px' }}
                          value={s.status}
                          onChange={(e) => handleStatusChange(match.id, e.target.value)}
                        >
                          <option value="pending">Por jugar</option>
                          <option value="live">En vivo</option>
                          <option value="finished">Finalizado</option>
                        </select>
                      </div>

                      {/* Acciones */}
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '8px 16px', width: 'auto', fontSize: '0.85rem' }}
                          onClick={() => handleUpdateMatch(match.id)}
                        >
                          Guardar
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '8px', width: 'auto', color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                          onClick={() => handleDeleteMatch(match.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA APUESTAS ESPECIALES */}
      {activeSubTab === 'custom_bets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Listado de Sugeridas (Pendientes) */}
          <div className="glass-container" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles style={{ color: 'var(--secondary)' }} /> Sugerencias de Apuestas de Usuarios (Pendientes)
            </h2>

            {customBets.filter(b => b.status === 'pending').length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No hay sugerencias pendientes por revisar.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {customBets.filter(b => b.status === 'pending').map(bet => (
                  <div 
                    key={bet.id} 
                    className="glass-container" 
                    style={{ 
                      padding: '16px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      flexWrap: 'wrap', 
                      gap: '15px',
                      background: 'rgba(255,255,255,0.01)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'white' }}>
                        "{bet.title}"
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Sugerida por: <strong>{bet.profiles?.display_name || 'Empleado'}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button 
                        className="btn btn-primary" 
                        style={{ padding: '8px 16px', width: 'auto', fontSize: '0.85rem' }}
                        onClick={() => handleApproveBet(bet.id)}
                      >
                        Aprobar y Habilitar
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '8px 16px', width: 'auto', fontSize: '0.85rem', color: 'var(--accent-red)', borderColor: 'rgba(239,68,68,0.2)' }}
                        onClick={() => handleRejectBet(bet.id)}
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Listado de Aprobadas / Activas (Para Resolver) */}
          <div className="glass-container" style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Trophy style={{ color: 'var(--primary)' }} /> Apuestas Especiales Activas y Cierre de Bolsa
            </h2>

            {customBets.filter(b => b.status === 'approved').length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No hay apuestas especiales activas abiertas para apuestas.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {customBets.filter(b => b.status === 'approved').map(bet => {
                  const resolved = bet.resolved_result !== null && bet.resolved_result !== '';
                  const userVal = resolvingResults[bet.id] || '';

                  return (
                    <div 
                      key={bet.id} 
                      className="glass-container" 
                      style={{ 
                        padding: '16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        flexWrap: 'wrap', 
                        gap: '15px',
                        background: 'rgba(255,255,255,0.01)',
                        borderColor: resolved ? 'var(--border-color)' : 'rgba(16, 185, 129, 0.2)'
                      }}
                    >
                      <div style={{ flex: '1 1 250px' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'white' }}>
                          "{bet.title}"
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {resolved ? (
                            <span style={{ color: 'var(--primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <CheckCircle2 size={14} /> Resuelta. Ganador: "{bet.resolved_result}"
                            </span>
                          ) : (
                            <span style={{ color: 'var(--secondary)' }}>Abierta para apuestas</span>
                          )}
                        </div>
                      </div>

                      {!resolved && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <input
                            type="text"
                            className="form-input"
                            style={{ width: '200px', padding: '8px 12px', fontSize: '0.9rem' }}
                            placeholder="Resultado (ej: Sí, No, Colombia, Messi)"
                            value={userVal}
                            onChange={(e) => setResolvingResults(prev => ({ ...prev, [bet.id]: e.target.value }))}
                          />
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '8px 16px', width: 'auto', fontSize: '0.85rem' }}
                            onClick={() => handleResolveBet(bet.id)}
                          >
                            Resolver y Pagar
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
