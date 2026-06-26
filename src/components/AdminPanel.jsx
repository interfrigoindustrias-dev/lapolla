import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { Calendar, PlusCircle, Trash2, ShieldCheck, Trophy, Sparkles, CheckCircle2, XCircle, DollarSign, Printer, Users, Edit } from 'lucide-react';

const renderAdminTeamIcon = (teamIcon) => {
  if (!teamIcon) return null;
  if (teamIcon.startsWith('http') || teamIcon.startsWith('/') || teamIcon.startsWith('data:image')) {
    return <img src={teamIcon} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />;
  }
  return <span style={{ fontSize: '1.1rem' }}>{teamIcon}</span>;
};


export default function AdminPanel() {
  const { profile } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState('matches'); // matches | custom_bets | recaudos | users
  
  // Estados para Partidos
  const [matches, setMatches] = useState([]);
  const [teamA, setTeamA] = useState('');
  const [teamB, setTeamB] = useState('');
  const [teamAIcon, setTeamAIcon] = useState('');
  const [teamBIcon, setTeamBIcon] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [minBet, setMinBet] = useState('2000');
  const [maxBet, setMaxBet] = useState('50000');
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState({}); // { [matchId]: { scoreA, scoreB, status } }
  const [editingMatchId, setEditingMatchId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  // Estados para Apuestas Especiales
  const [customBets, setCustomBets] = useState([]);
  const [resolvingResults, setResolvingResults] = useState({}); // { [betId]: resultText }

  // Estados para Recaudos
  const [allPredictions, setAllPredictions] = useState([]);
  const [allCustomPredictions, setAllCustomPredictions] = useState([]);
  const [recaudoFilter, setRecaudoFilter] = useState('pending'); // pending | all

  // Estados para Gestión de Usuarios
  const [allProfiles, setAllProfiles] = useState([]);

  useEffect(() => {
    if (profile?.is_admin) {
      if (activeSubTab === 'matches') {
        fetchMatches();
      } else if (activeSubTab === 'custom_bets') {
        fetchCustomBets();
      } else if (activeSubTab === 'recaudos') {
        fetchRecaudosData();
        fetchMatches();
        fetchCustomBets();
      } else if (activeSubTab === 'users') {
        fetchProfiles();
      }
    }
  }, [profile, activeSubTab]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('display_name', { ascending: true });
    
    if (error) {
      console.error('Error cargando perfiles en admin:', error);
    } else {
      setAllProfiles(data || []);
    }
  };

  const toggleAdminStatus = async (userId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: !currentStatus })
        .eq('id', userId);

      if (error) throw error;
      fetchProfiles();
      alert('Permisos de administrador actualizados con éxito.');
    } catch (err) {
      alert('Error actualizando permisos: ' + (err.message || err));
    }
  };

  const fetchRecaudosData = async () => {
    try {
      const { data: matchPreds, error: mpError } = await supabase
        .from('predictions')
        .select(`
          id,
          bet_amount,
          has_paid,
          gain,
          profiles:user_id (display_name, department),
          matches:match_id (team_a, team_b, status, score_a, score_b)
        `)
        .order('created_at', { ascending: false });

      if (mpError) throw mpError;
      setAllPredictions(matchPreds || []);

      const { data: customPreds, error: cpError } = await supabase
        .from('custom_bet_predictions')
        .select(`
          id,
          bet_amount,
          has_paid,
          gain,
          profiles:user_id (display_name, department),
          custom_bets:custom_bet_id (title, status, resolved_result)
        `)
        .order('created_at', { ascending: false });

      if (cpError) throw cpError;
      setAllCustomPredictions(customPreds || []);
    } catch (err) {
      console.error('Error cargando recaudos:', err);
    }
  };

  const handleToggleMatchPayment = async (pred) => {
    const newStatus = !pred.has_paid;
    try {
      const { error } = await supabase
        .from('predictions')
        .update({ has_paid: newStatus })
        .eq('id', pred.id);

      if (error) throw error;
      setAllPredictions(prev => prev.map(p => p.id === pred.id ? { ...p, has_paid: newStatus } : p));
    } catch (err) {
      alert('Error actualizando pago: ' + err.message);
    }
  };

  const handleToggleCustomPayment = async (pred) => {
    const newStatus = !pred.has_paid;
    try {
      const { error } = await supabase
        .from('custom_bet_predictions')
        .update({ has_paid: newStatus })
        .eq('id', pred.id);

      if (error) throw error;
      setAllCustomPredictions(prev => prev.map(p => p.id === pred.id ? { ...p, has_paid: newStatus } : p));
    } catch (err) {
      alert('Error actualizando pago: ' + err.message);
    }
  };

  const handlePrintBettors = (matchOrBetId, type) => {
    let title = "";
    let bettorsList = [];

    if (type === 'match') {
      const match = matches.find(m => m.id === matchOrBetId);
      if (!match) return;
      title = `Planilla de Cobro - Partido: ${match.team_a} vs ${match.team_b}`;
      bettorsList = allPredictions.filter(p => p.match_id === matchOrBetId);
    } else {
      const bet = customBets.find(b => b.id === matchOrBetId);
      if (!bet) return;
      title = `Planilla de Cobro - Especial: "${bet.title}"`;
      bettorsList = allCustomPredictions.filter(p => p.custom_bet_id === matchOrBetId);
    }

    if (bettorsList.length === 0) {
      alert("No hay apuestas registradas para este evento.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor permite las ventanas emergentes (pop-ups) para imprimir.");
      return;
    }

    const rowsHtml = bettorsList.map((b, idx) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold;">${b.profiles?.display_name || 'Empleado'}</td>
        <td style="border: 1px solid #ddd; padding: 10px;">${b.profiles?.department || 'N/A'}</td>
        <td style="border: 1px solid #ddd; padding: 10px; font-weight: bold; text-align: right;">$${b.bet_amount.toLocaleString('es-CO')}</td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">
          ${type === 'match' ? `${b.pred_score_a} - ${b.pred_score_b}` : b.prediction_value}
        </td>
        <td style="border: 1px solid #ddd; padding: 10px; text-align: center; font-weight: bold; color: ${b.has_paid ? '#10b981' : '#f59e0b'};">
          ${b.has_paid ? 'Cobrado' : 'PENDIENTE'}
        </td>
        <td style="border: 1px solid #ddd; padding: 10px; width: 120px;"></td>
      </tr>
    `).join('');

    const totalCollected = bettorsList.filter(b => b.has_paid).reduce((sum, b) => sum + b.bet_amount, 0);
    const totalPending = bettorsList.filter(b => !b.has_paid).reduce((sum, b) => sum + b.bet_amount, 0);
    const totalAmount = bettorsList.reduce((sum, b) => sum + b.bet_amount, 0);

    const docHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #333; margin: 30px; font-size: 13px; }
          h1 { font-size: 20px; color: #111; margin-bottom: 5px; }
          .meta { font-size: 12px; color: #666; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 10px; font-weight: bold; font-size: 12px; text-align: left; }
          .summary-box { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; border: 1px solid #ccc; background-color: #fafafa; padding: 15px; border-radius: 6px; margin-bottom: 30px; }
          .summary-item { font-size: 13px; }
          .summary-value { font-weight: bold; font-size: 18px; margin-top: 4px; }
          .footer { margin-top: 50px; font-size: 11px; text-align: center; color: #999; border-top: 1px dashed #ccc; padding-top: 15px; }
          @media print {
            body { margin: 15px; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
          <div>
            <h1 style="margin: 0 0 5px 0;">LudoPollas - Control de Cobros</h1>
            <div class="meta">Generado el ${new Date().toLocaleString('es-CO')} | Empresa: Interfrigo</div>
          </div>
          <button onclick="window.print();" style="padding: 10px 18px; background-color: #10b981; color: white; border: none; font-weight: bold; border-radius: 4px; cursor: pointer; font-size: 13px;">
            🖨️ Imprimir Planilla
          </button>
        </div>

        <h3 style="font-size: 15px; margin-top: 0; margin-bottom: 15px;">Evento: <span style="font-weight: normal; color: #555;">${title.replace('Planilla de Cobro - ', '')}</span></h3>

        <div class="summary-box">
          <div class="summary-item">
            <div>Cobrado / Recibido:</div>
            <div class="summary-value" style="color: #10b981;">$${totalCollected.toLocaleString('es-CO')}</div>
          </div>
          <div class="summary-item">
            <div>Pendiente por Cobrar:</div>
            <div class="summary-value" style="color: #f59e0b;">$${totalPending.toLocaleString('es-CO')}</div>
          </div>
          <div class="summary-item">
            <div>Total Esperado:</div>
            <div class="summary-value" style="color: #111;">$${totalAmount.toLocaleString('es-CO')}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">#</th>
              <th>Participante</th>
              <th>Departamento / Área</th>
              <th style="text-align: right; width: 120px;">Monto Apostado</th>
              <th style="width: 110px; text-align: center;">Predicción</th>
              <th style="width: 120px; text-align: center;">Estado Recaudo</th>
              <th style="width: 140px; text-align: center;">Firma / OK</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer">
          LudoPollas - Control Interno. Todos los derechos reservados.
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(docHtml);
    printWindow.document.close();
  };

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
          team_a_icon: teamAIcon.trim() || null,
          team_b_icon: teamBIcon.trim() || null,
          match_date: new Date(matchDate).toISOString(),
          min_bet: parseFloat(minBet) || 2000,
          max_bet: parseFloat(maxBet) || 50000,
          status: 'pending'
        });

      if (error) throw error;

      setTeamA('');
      setTeamB('');
      setTeamAIcon('');
      setTeamBIcon('');
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

  const startEditing = (match) => {
    setEditingMatchId(match.id);
    setEditFormData({
      teamA: match.team_a,
      teamB: match.team_b,
      teamAIcon: match.team_a_icon || '',
      teamBIcon: match.team_b_icon || '',
      matchDate: new Date(match.match_date).toISOString().substring(0, 16),
      minBet: match.min_bet.toString(),
      maxBet: match.max_bet.toString()
    });
  };

  const handleSaveEditedMatch = async (matchId) => {
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          team_a: editFormData.teamA.trim(),
          team_b: editFormData.teamB.trim(),
          team_a_icon: editFormData.teamAIcon.trim() || null,
          team_b_icon: editFormData.teamBIcon.trim() || null,
          match_date: new Date(editFormData.matchDate).toISOString(),
          min_bet: parseFloat(editFormData.minBet) || 2000,
          max_bet: parseFloat(editFormData.maxBet) || 50000
        })
        .eq('id', matchId);

      if (error) throw error;
      setEditingMatchId(null);
      fetchMatches();
      alert('Partido actualizado con éxito.');
    } catch (err) {
      alert('Error guardando cambios del partido: ' + (err.message || err));
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
          <button 
            className={`tab ${activeSubTab === 'recaudos' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('recaudos')}
            style={{ padding: '8px 16px' }}
          >
            <DollarSign size={16} style={{ marginRight: '6px', display: 'inline-flex', verticalAlign: 'middle' }} />
            Recaudos
          </button>
          <button 
            className={`tab ${activeSubTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('users')}
            style={{ padding: '8px 16px' }}
          >
            <Users size={16} style={{ marginRight: '6px', display: 'inline-flex', verticalAlign: 'middle' }} />
            Usuarios / Admins
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

            <form onSubmit={handleAddMatch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Equipo A</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ej. Francia"
                  value={teamA}
                  onChange={(e) => setTeamA(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Icono/Emoji A (ej: 🇨🇴 o URL)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Emoji o URL de imagen"
                  value={teamAIcon}
                  onChange={(e) => setTeamAIcon(e.target.value)}
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
                <label className="form-label">Icono/Emoji B (ej: 🏴󠁧󠁢󠁥󠁮󠁧󠁿 o URL)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Emoji o URL de imagen"
                  value={teamBIcon}
                  onChange={(e) => setTeamBIcon(e.target.value)}
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
                  
                  if (editingMatchId === match.id) {
                    return (
                      <div 
                        key={match.id} 
                        className="glass-container" 
                        style={{ 
                          padding: '20px', 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '15px',
                          background: 'rgba(255,255,255,0.02)',
                          borderColor: 'var(--primary)'
                        }}
                      >
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Equipo A</label>
                          <input
                            type="text"
                            className="form-input"
                            value={editFormData.teamA}
                            onChange={(e) => setEditFormData({ ...editFormData, teamA: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Icono A (Emoji o URL)</label>
                          <input
                            type="text"
                            className="form-input"
                            value={editFormData.teamAIcon}
                            onChange={(e) => setEditFormData({ ...editFormData, teamAIcon: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Equipo B</label>
                          <input
                            type="text"
                            className="form-input"
                            value={editFormData.teamB}
                            onChange={(e) => setEditFormData({ ...editFormData, teamB: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Icono B (Emoji o URL)</label>
                          <input
                            type="text"
                            className="form-input"
                            value={editFormData.teamBIcon}
                            onChange={(e) => setEditFormData({ ...editFormData, teamBIcon: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Fecha</label>
                          <input
                            type="datetime-local"
                            className="form-input"
                            value={editFormData.matchDate}
                            onChange={(e) => setEditFormData({ ...editFormData, matchDate: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Mínimo ($)</label>
                          <input
                            type="number"
                            className="form-input"
                            value={editFormData.minBet}
                            onChange={(e) => setEditFormData({ ...editFormData, minBet: e.target.value })}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: '0.75rem' }}>Máximo ($)</label>
                          <input
                            type="number"
                            className="form-input"
                            value={editFormData.maxBet}
                            onChange={(e) => setEditFormData({ ...editFormData, maxBet: e.target.value })}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'end', gridColumn: '1 / -1', justifyContent: 'flex-end', marginTop: '10px' }}>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '8px 16px', width: 'auto', fontSize: '0.85rem' }}
                            onClick={() => handleSaveEditedMatch(match.id)}
                          >
                            Guardar Cambios
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '8px 16px', width: 'auto', fontSize: '0.85rem' }}
                            onClick={() => setEditingMatchId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    );
                  }

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
                        <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {renderAdminTeamIcon(match.team_a_icon)} {match.team_a} vs {renderAdminTeamIcon(match.team_b_icon)} {match.team_b}
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
                          Guardar Marcador
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '8px', width: 'auto', color: 'var(--primary)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                          onClick={() => startEditing(match)}
                          title="Editar Partido"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '8px', width: 'auto', color: 'var(--accent-red)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                          onClick={() => handleDeleteMatch(match.id)}
                          title="Eliminar Partido"
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

      {/* VISTA RECAUDOS */}
      {activeSubTab === 'recaudos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Tarjeta de Resumen */}
          <div className="glass-container" style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white', marginBottom: '10px' }}>Resumen de Recaudos</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Control de caja para dinero de apuestas individuales.</p>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', color: 'var(--primary)', justifyContent: 'center' }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)' }}>
                  ${(
                    allPredictions.filter(p => p.has_paid).reduce((sum, p) => sum + p.bet_amount, 0) +
                    allCustomPredictions.filter(p => p.has_paid).reduce((sum, p) => sum + p.bet_amount, 0)
                  ).toLocaleString('es-CO')}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cobrado / Recibido</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', color: 'var(--accent-red)', justifyContent: 'center' }}>
                <XCircle size={20} />
              </div>
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f87171' }}>
                  ${(
                    allPredictions.filter(p => !p.has_paid).reduce((sum, p) => sum + p.bet_amount, 0) +
                    allCustomPredictions.filter(p => !p.has_paid).reduce((sum, p) => sum + p.bet_amount, 0)
                  ).toLocaleString('es-CO')}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pendiente por Cobrar</div>
              </div>
            </div>
          </div>

          {/* Planillas Imprimibles por Evento */}
          <div className="glass-container" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Printer style={{ color: 'var(--primary)' }} /> Planillas de Cobro Imprimibles
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', marginBottom: '20px' }}>
              Selecciona un evento para abrir y mandar a imprimir una hoja de control de cobros con las firmas y montos de todos los apostadores.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
              {/* Partidos con apuestas */}
              {matches.filter(m => allPredictions.some(p => p.match_id === m.id)).map(match => {
                const count = allPredictions.filter(p => p.match_id === match.id).length;
                const total = allPredictions.filter(p => p.match_id === match.id).reduce((sum, p) => sum + p.bet_amount, 0);
                
                return (
                  <div key={match.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{match.team_a} vs {match.team_b}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{count} apostadores | Total: <strong>${total.toLocaleString('es-CO')}</strong></div>
                    </div>
                    <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handlePrintBettors(match.id, 'match')}>
                      <Printer size={14} /> Planilla
                    </button>
                  </div>
                );
              })}

              {/* Especiales con apuestas */}
              {customBets.filter(b => allCustomPredictions.some(p => p.custom_bet_id === b.id)).map(bet => {
                const count = allCustomPredictions.filter(p => p.custom_bet_id === bet.id).length;
                const total = allCustomPredictions.filter(p => p.custom_bet_id === bet.id).reduce((sum, p) => sum + p.bet_amount, 0);
                
                return (
                  <div key={bet.id} style={{ padding: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1, marginRight: '10px' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>"{bet.title}"</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{count} apostadores | Total: <strong>${total.toLocaleString('es-CO')}</strong></div>
                    </div>
                    <button className="btn btn-secondary" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handlePrintBettors(bet.id, 'custom')}>
                      <Printer size={14} /> Planilla
                    </button>
                  </div>
                );
              })}

              {matches.filter(m => allPredictions.some(p => p.match_id === m.id)).length === 0 &&
               customBets.filter(b => allCustomPredictions.some(p => p.custom_bet_id === b.id)).length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', gridColumn: '1 / -1', textAlign: 'center' }}>
                  No hay partidos ni apuestas especiales con predicciones activas para imprimir planillas.
                </p>
              )}
            </div>
          </div>

          {/* Tabla de Control */}
          <div className="glass-container" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Registro de Transacciones</h3>
              <select 
                className="form-input" 
                style={{ width: '150px', padding: '6px 12px', fontSize: '0.85rem' }}
                value={recaudoFilter}
                onChange={(e) => setRecaudoFilter(e.target.value)}
              >
                <option value="pending">Solo Pendientes</option>
                <option value="all">Ver Todos</option>
              </select>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px' }}>Usuario</th>
                    <th style={{ padding: '10px' }}>Área</th>
                    <th style={{ padding: '10px' }}>Tipo</th>
                    <th style={{ padding: '10px' }}>Detalle Apuesta</th>
                    <th style={{ padding: '10px' }}>Monto</th>
                    <th style={{ padding: '10px', width: '140px' }}>Estado Caja</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Predicciones de partidos */}
                  {allPredictions
                    .filter(p => recaudoFilter === 'all' || !p.has_paid)
                    .map(pred => (
                      <tr key={`match-${pred.id}`} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>{pred.profiles?.display_name}</td>
                        <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{pred.profiles?.department}</td>
                        <td style={{ padding: '12px 10px' }}><span className="match-status-badge pending" style={{ background: 'rgba(59, 130, 246, 0.15)', color: 'var(--accent-blue)' }}>Partido</span></td>
                        <td style={{ padding: '12px 10px' }}>
                          {pred.matches ? `${pred.matches.team_a} vs ${pred.matches.team_b}` : 'Partido'}
                        </td>
                        <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>${pred.bet_amount?.toLocaleString('es-CO')}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <button
                            onClick={() => handleToggleMatchPayment(pred)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              color: pred.has_paid ? 'var(--primary)' : 'var(--text-muted)'
                            }}
                          >
                            {pred.has_paid ? (
                              <>
                                <CheckCircle2 size={16} style={{ color: 'var(--primary)' }} />
                                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Recibido</span>
                              </>
                            ) : (
                              <>
                                <XCircle size={16} style={{ color: 'var(--text-muted)' }} />
                                <span>Pendiente</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}

                  {/* Predicciones especiales */}
                  {allCustomPredictions
                    .filter(p => recaudoFilter === 'all' || !p.has_paid)
                    .map(pred => (
                      <tr key={`custom-${pred.id}`} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>{pred.profiles?.display_name}</td>
                        <td style={{ padding: '12px 10px', color: 'var(--text-muted)' }}>{pred.profiles?.department}</td>
                        <td style={{ padding: '12px 10px' }}><span className="match-status-badge pending" style={{ background: 'rgba(251, 191, 36, 0.15)', color: 'var(--secondary)' }}>Especial</span></td>
                        <td style={{ padding: '12px 10px', fontStyle: 'italic' }}>
                          {pred.custom_bets ? `"${pred.custom_bets.title}"` : 'Apuesta Especial'}
                        </td>
                        <td style={{ padding: '12px 10px', fontWeight: 'bold' }}>${pred.bet_amount?.toLocaleString('es-CO')}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <button
                            onClick={() => handleToggleCustomPayment(pred)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              color: pred.has_paid ? 'var(--primary)' : 'var(--text-muted)'
                            }}
                          >
                            {pred.has_paid ? (
                              <>
                                <CheckCircle2 size={16} style={{ color: 'var(--primary)' }} />
                                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Recibido</span>
                              </>
                            ) : (
                              <>
                                <XCircle size={16} style={{ color: 'var(--text-muted)' }} />
                                <span>Pendiente</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}

                  {allPredictions.filter(p => recaudoFilter === 'all' || !p.has_paid).length === 0 &&
                   allCustomPredictions.filter(p => recaudoFilter === 'all' || !p.has_paid).length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        No hay transacciones registradas que coincidan con el filtro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VISTA USUARIOS / ADMINS */}
      {activeSubTab === 'users' && (
        <div className="glass-container" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Users style={{ color: 'var(--primary)' }} /> Gestión de Usuarios y Administradores
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px', marginBottom: '20px' }}>
            Aquí puedes promover usuarios de la empresa como administradores de LudoPollas o revocar sus permisos.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="recaudos-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Usuario</th>
                  <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Área / Departamento</th>
                  <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>Rol Actual</th>
                  <th style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {allProfiles.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '12px 8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: p.is_admin ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
                        color: p.is_admin ? 'var(--primary)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                        fontSize: '0.85rem'
                      }}>
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          (p.display_name || 'U').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{p.display_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {p.id.substring(0, 8)}...</div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: '0.85rem' }}>
                      {p.department || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin asignar</span>}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '50px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        background: p.is_admin ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                        color: p.is_admin ? 'var(--primary)' : 'var(--text-muted)'
                      }}>
                        {p.is_admin ? 'Administrador' : 'Apostador'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {p.id === profile?.id ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Tú (Actual)</span>
                      ) : (
                        <button
                          className={`btn ${p.is_admin ? 'btn-secondary' : 'btn-primary'}`}
                          onClick={() => toggleAdminStatus(p.id, p.is_admin)}
                          style={{
                            width: 'auto',
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            background: p.is_admin ? 'rgba(239, 68, 68, 0.1)' : 'var(--primary)',
                            color: p.is_admin ? '#f87171' : 'var(--bg-obsidian)',
                            border: p.is_admin ? '1px solid rgba(239, 68, 68, 0.2)' : 'none'
                          }}
                        >
                          {p.is_admin ? 'Quitar Admin' : 'Hacer Admin'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {allProfiles.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                      No se encontraron usuarios.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
