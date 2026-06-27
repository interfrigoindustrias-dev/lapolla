import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import Instructions from './Instructions';
import ChatWall from './ChatWall';
import Confetti from './Confetti';
import { Trophy, Calendar, Check, Play, Lock, Users, PlusCircle, LogIn, DollarSign, Sparkles, Send, Info, BookOpen, Award, CheckCircle2, XCircle, ArrowRight, Activity, Zap, Bell } from 'lucide-react';

const renderTeamIcon = (teamName, teamIcon) => {
  if (!teamIcon) {
    return <div className="team-flag">{teamName.substring(0, 3).toUpperCase()}</div>;
  }
  if (teamIcon.startsWith('http://') || teamIcon.startsWith('https://') || teamIcon.startsWith('/') || teamIcon.startsWith('data:image')) {
    return (
      <div className="team-flag" style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 0 }}>
        <img src={teamIcon} alt={teamName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
    );
  }
  return (
    <div className="team-flag" style={{ fontSize: '1.8rem', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
      {teamIcon}
    </div>
  );
};

export default function Dashboard({ onSelectPool }) {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('matches'); // matches | custom_bets | leaderboard | pools | instructions
  
  // Confetti
  const [showConfetti, setShowConfetti] = useState(false);

  // Partidos
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [localPreds, setLocalPreds] = useState({}); // { [matchId]: { scoreA, scoreB, betAmount } }
  const [savingPreds, setSavingPreds] = useState({});
  const [matchPoolSums, setMatchPoolSums] = useState({});
  const [matchConsensus, setMatchConsensus] = useState({}); // { [matchId]: { teamA%, teamB%, draw% } }

  // Tabla general
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardSubTab, setLeaderboardSubTab] = useState('users'); // users | depts
  const [deptLeaderboard, setDeptLeaderboard] = useState([]);
  const [allPredictionsData, setAllPredictionsData] = useState([]); // Para el simulador
  const [allCustomPredictionsData, setAllCustomPredictionsData] = useState([]);
  const [expandedBets, setExpandedBets] = useState({});

  // Simulador de Posiciones
  const [simulatedMode, setSimulatedMode] = useState(false);
  const [simulatedScores, setSimulatedScores] = useState({}); // { [matchId]: { scoreA, scoreB } }

  // Pollas
  const [pools, setPools] = useState([]);

  // Especiales (Custom Bets)
  const [customBets, setCustomBets] = useState([]);
  const [customPredictions, setCustomPredictions] = useState({});
  const [localCustomPreds, setLocalCustomPreds] = useState({});
  const [customBetPoolSums, setCustomBetPoolSums] = useState({});
  const [savingCustomPreds, setSavingCustomPreds] = useState({});
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestLoading, setSuggestLoading] = useState(false);

  // Retos P2P (1v1)
  const [p2pChallenges, setP2pChallenges] = useState([]);
  const [allProfiles, setAllProfiles] = useState([]);
  const [p2pOpponentId, setP2pOpponentId] = useState('');
  const [p2pMatchId, setP2pMatchId] = useState('');
  const [p2pPrediction, setP2pPrediction] = useState('team_a');
  const [p2pAmount, setP2pAmount] = useState('5000');
  const [p2pLoading, setP2pLoading] = useState(false);
  const [activeSpecialSubTab, setActiveSpecialSubTab] = useState('specials');

  // Modals / forms states
  const [showCreatePool, setShowCreatePool] = useState(false);
  const [showJoinPool, setShowJoinPool] = useState(false);
  const [newPoolName, setNewPoolName] = useState('');
  const [newPoolFee, setNewPoolFee] = useState('0');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    fetchMatches();
    fetchUserPredictions();
    fetchLeaderboard();
    fetchUserPools();
    if (user) {
      fetchCustomBetsData();
      fetchP2pData();
    }
  }, [user]);

  // Suscripción Realtime para Notificaciones de Retos 1v1
  useEffect(() => {
    if (!user) return;

    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    const channel = supabase
      .channel(`p2p_challenges_realtime:${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'p2p_challenges',
        filter: `challenged_id=eq.${user.id}`
      }, async (payload) => {
        // Refrescar los retos de la UI
        fetchP2pData();

        // Mostrar notificación flotante si está permitido
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          try {
            const challengerId = payload.new.challenger_id;
            const matchId = payload.new.match_id;
            const betAmount = payload.new.bet_amount;

            // Consultar datos para el mensaje
            const { data: prof } = await supabase.from('profiles').select('display_name').eq('id', challengerId).single();
            const { data: match } = await supabase.from('matches').select('team_a, team_b').eq('id', matchId).single();

            const name = prof?.display_name || 'Un compañero';
            const matchText = match ? `${match.team_a} vs ${match.team_b}` : 'un partido';

            const notification = new Notification('⚔️ ¡Nuevo Reto 1v1 Recibido!', {
              body: `${name} te ha retado para el partido ${matchText} por $${betAmount.toLocaleString('es-CO')} COP.`,
              icon: '/favicon.svg',
              requireInteraction: true
            });

            notification.onclick = () => {
              window.focus();
              setActiveTab('custom_bets');
              setActiveSpecialSubTab('p2p');
              notification.close();
            };
          } catch (err) {
            console.error('Error mostrando notificación flotante:', err);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchMatches = async () => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('match_date', { ascending: true });

    if (error) console.error('Error cargando partidos:', error);
    else {
      setMatches(data || []);
      fetchMatchPoolSumsAndConsensus(data || []);
    }
  };

  const fetchMatchPoolSumsAndConsensus = async (matchesList) => {
    const { data, error } = await supabase
      .from('predictions')
      .select('match_id, bet_amount, pred_score_a, pred_score_b');

    if (error) {
      console.error('Error cargando pool sums y consenso:', error);
    } else {
      const sumMap = {};
      const consensusMap = {};

      data?.forEach(p => {
        sumMap[p.match_id] = (sumMap[p.match_id] || 0) + p.bet_amount;

        if (!consensusMap[p.match_id]) {
          consensusMap[p.match_id] = { teamA: 0, teamB: 0, draw: 0, total: 0 };
        }
        const stats = consensusMap[p.match_id];
        if (p.pred_score_a > p.pred_score_b) stats.teamA += 1;
        else if (p.pred_score_b > p.pred_score_a) stats.teamB += 1;
        else stats.draw += 1;
        stats.total += 1;
      });

      setMatchPoolSums(sumMap);

      const formattedConsensus = {};
      matchesList.forEach(m => {
        const stats = consensusMap[m.id];
        if (stats && stats.total > 0) {
          formattedConsensus[m.id] = {
            a: Math.round((stats.teamA / stats.total) * 100),
            draw: Math.round((stats.draw / stats.total) * 100),
            b: Math.round((stats.teamB / stats.total) * 100),
            total: stats.total
          };
        }
      });
      setMatchConsensus(formattedConsensus);
    }
  };

  const fetchUserPredictions = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error cargando predicciones:', error);
    } else {
      const predMap = {};
      const localMap = {};
      data?.forEach(pred => {
        predMap[pred.match_id] = pred;
        localMap[pred.match_id] = {
          scoreA: pred.pred_score_a,
          scoreB: pred.pred_score_b,
          betAmount: pred.bet_amount
        };
      });
      setPredictions(predMap);
      setLocalPreds(localMap);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, display_name, department');

      const { data: preds, error: prError } = await supabase
        .from('predictions')
        .select('user_id, match_id, points_earned, pred_score_a, pred_score_b, gain, bet_amount');

      const { data: customPreds, error: cprError } = await supabase
        .from('custom_bet_predictions')
        .select('user_id, custom_bet_id, bet_amount, prediction_value, gain');

      if (pError || prError || cprError) throw pError || prError || cprError;

      // Guardar todas las predicciones para el simulador y visualización
      setAllPredictionsData(preds || []);
      setAllCustomPredictionsData(customPreds || []);

      const pointsMap = {};
      const gainMap = {};

      preds?.forEach(p => {
        pointsMap[p.user_id] = (pointsMap[p.user_id] || 0) + p.points_earned;
        gainMap[p.user_id] = (gainMap[p.user_id] || 0) + p.gain;
      });

      customPreds?.forEach(p => {
        gainMap[p.user_id] = (gainMap[p.user_id] || 0) + p.gain;
      });

      const sortedLeaderboard = profiles
        .map(p => ({
          ...p,
          points: pointsMap[p.id] || 0,
          totalGain: gainMap[p.id] || 0
        }))
        .sort((a, b) => b.points - a.points);

      setLeaderboard(sortedLeaderboard);

      // Calcular liga de departamentos
      const deptPoints = {};
      const deptCounts = {};

      sortedLeaderboard.forEach(item => {
        const dept = item.department || 'Otros';
        deptPoints[dept] = (deptPoints[dept] || 0) + item.points;
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      });

      const sortedDepts = Object.keys(deptPoints).map(dept => ({
        name: dept,
        points: parseFloat((deptPoints[dept] / deptCounts[dept]).toFixed(1)),
        members: deptCounts[dept]
      })).sort((a, b) => b.points - a.points);

      setDeptLeaderboard(sortedDepts);

    } catch (err) {
      console.error('Error cargando tabla general:', err);
    }
  };

  const fetchUserPools = async () => {
    if (!user) return;
    try {
      const { data: memberOf, error: mError } = await supabase
        .from('pool_members')
        .select('pool_id')
        .eq('user_id', user.id);

      if (mError) throw mError;
      if (!memberOf || memberOf.length === 0) {
        setPools([]);
        return;
      }

      const poolIds = memberOf.map(m => m.pool_id);

      const { data: poolsData, error: pError } = await supabase
        .from('pools')
        .select(`
          *,
          profiles:created_by (display_name),
          pool_members (id)
        `)
        .in('id', poolIds);

      if (pError) throw pError;
      setPools(poolsData || []);
    } catch (err) {
      console.error('Error cargando pollas del usuario:', err);
    }
  };

  // DATOS APUESTAS ESPECIALES
  const fetchCustomBetsData = async () => {
    try {
      const { data: bets, error: bError } = await supabase
        .from('custom_bets')
        .select(`
          *,
          profiles:user_id (display_name)
        `)
        .or('status.eq.approved')
        .order('created_at', { ascending: false });

      if (bError) throw bError;
      setCustomBets(bets || []);

      const { data: myPreds, error: mpError } = await supabase
        .from('custom_bet_predictions')
        .select('*')
        .eq('user_id', user.id);

      if (mpError) throw mpError;
      const myPredsMap = {};
      const localMap = {};
      myPreds?.forEach(p => {
        myPredsMap[p.custom_bet_id] = p;
        localMap[p.custom_bet_id] = {
          predictionValue: p.prediction_value,
          betAmount: p.bet_amount
        };
      });
      setCustomPredictions(myPredsMap);
      setLocalCustomPreds(localMap);

      const { data: allPools, error: apError } = await supabase
        .from('custom_bet_predictions')
        .select('custom_bet_id, bet_amount');

      if (apError) throw apError;
      const sumMap = {};
      allPools?.forEach(p => {
        sumMap[p.custom_bet_id] = (sumMap[p.custom_bet_id] || 0) + p.bet_amount;
      });
      setCustomBetPoolSums(sumMap);

    } catch (err) {
      console.error('Error cargando datos de especiales:', err);
    }
  };

  // DATOS RETOS P2P (1v1)
  const fetchP2pData = async () => {
    try {
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, display_name, department')
        .neq('id', user.id);

      if (pError) throw pError;
      setAllProfiles(profiles || []);

      const { data: challenges, error: cError } = await supabase
        .from('p2p_challenges')
        .select(`
          *,
          challenger:challenger_id (display_name),
          challenged:challenged_id (display_name),
          matches:match_id (team_a, team_b, status, score_a, score_b)
        `)
        .or(`challenger_id.eq.${user.id},challenged_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (cError) throw cError;
      setP2pChallenges(challenges || []);
    } catch (err) {
      console.error('Error cargando retos P2P:', err);
    }
  };

  const savePrediction = async (matchId, match) => {
    const scoreA = localPreds[matchId]?.scoreA;
    const scoreB = localPreds[matchId]?.scoreB;
    const betAmount = localPreds[matchId]?.betAmount ?? match.min_bet;

    if (scoreA === undefined || scoreA === '' || scoreB === undefined || scoreB === '') {
      alert('Por favor completa ambos marcadores para apostar.');
      return;
    }

    if (betAmount < match.min_bet || betAmount > match.max_bet) {
      alert(`El monto apostado debe estar entre $${match.min_bet.toLocaleString()} y $${match.max_bet.toLocaleString()}`);
      return;
    }

    setSavingPreds(prev => ({ ...prev, [matchId]: true }));

    try {
      const existingPred = predictions[matchId];
      
      if (existingPred) {
        const { data, error } = await supabase
          .from('predictions')
          .update({
            pred_score_a: scoreA,
            pred_score_b: scoreB,
            bet_amount: betAmount
          })
          .eq('id', existingPred.id)
          .select()
          .single();

        if (error) throw error;
        setPredictions(prev => ({ ...prev, [matchId]: data }));
      } else {
        const { data, error } = await supabase
          .from('predictions')
          .insert({
            user_id: user.id,
            match_id: matchId,
            pred_score_a: scoreA,
            pred_score_b: scoreB,
            bet_amount: betAmount
          })
          .select()
          .single();

        if (error) throw error;
        setPredictions(prev => ({ ...prev, [matchId]: data }));
      }
      
      fetchMatches();
      fetchLeaderboard();
      
      // Activar Confetti 🎉
      setShowConfetti(true);
    } catch (err) {
      alert('Error guardando apuesta: ' + (err.message || err));
    } finally {
      setSavingPreds(prev => ({ ...prev, [matchId]: false }));
    }
  };

  // SUGERIR APUESTA ESPECIAL
  const handleSuggestCustomBet = async (e) => {
    e.preventDefault();
    if (!suggestTitle.trim()) return;
    setSuggestLoading(true);

    try {
      const { error } = await supabase
        .from('custom_bets')
        .insert({
          user_id: user.id,
          title: suggestTitle.trim(),
          status: 'pending'
        });

      if (error) throw error;
      setSuggestTitle('');
      alert('Sugerencia enviada. El administrador la revisará pronto.');
    } catch (err) {
      alert('Error enviando sugerencia: ' + err.message);
    } finally {
      setSuggestLoading(false);
    }
  };

  const saveCustomPrediction = async (betId, bet) => {
    const predVal = localCustomPreds[betId]?.predictionValue?.trim();
    const betAmount = localCustomPreds[betId]?.betAmount ?? bet.min_bet;

    if (!predVal) {
      alert('Por favor escribe tu pronóstico.');
      return;
    }

    if (betAmount < bet.min_bet || betAmount > bet.max_bet) {
      alert(`El monto debe estar entre $${bet.min_bet.toLocaleString()} y $${bet.max_bet.toLocaleString()}`);
      return;
    }

    setSavingCustomPreds(prev => ({ ...prev, [betId]: true }));

    try {
      const existing = customPredictions[betId];

      if (existing) {
        const { data, error } = await supabase
          .from('custom_bet_predictions')
          .update({
            prediction_value: predVal,
            bet_amount: betAmount
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        setCustomPredictions(prev => ({ ...prev, [betId]: data }));
      } else {
        const { data, error } = await supabase
          .from('custom_bet_predictions')
          .insert({
            custom_bet_id: betId,
            user_id: user.id,
            prediction_value: predVal,
            bet_amount: betAmount
          })
          .select()
          .single();

        if (error) throw error;
        setCustomPredictions(prev => ({ ...prev, [betId]: data }));
      }

      fetchCustomBetsData();
      fetchLeaderboard();
      setShowConfetti(true);
    } catch (err) {
      alert('Error guardando apuesta especial: ' + err.message);
    } finally {
      setSavingCustomPreds(prev => ({ ...prev, [betId]: false }));
    }
  };

  // RETOS P2P (1v1)
  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    if (!p2pOpponentId || !p2pMatchId || !p2pAmount) {
      alert('Por favor completa todos los campos del reto.');
      return;
    }

    const amt = parseFloat(p2pAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Ingresa un monto de dinero válido.');
      return;
    }

    const matchObj = matches.find(m => m.id === p2pMatchId);
    if (matchObj && (amt < matchObj.min_bet || amt > matchObj.max_bet)) {
      alert(`El monto del reto debe estar entre $${matchObj.min_bet.toLocaleString()} y $${matchObj.max_bet.toLocaleString()}`);
      return;
    }

    setP2pLoading(true);

    try {
      const { error } = await supabase
        .from('p2p_challenges')
        .insert({
          challenger_id: user.id,
          challenged_id: p2pOpponentId,
          match_id: p2pMatchId,
          challenger_prediction: p2pPrediction,
          amount: amt,
          status: 'pending'
        });

      if (error) throw error;

      setP2pOpponentId('');
      setP2pMatchId('');
      fetchP2pData();
      alert('¡Reto enviado! Tu compañero recibirá la solicitud.');
    } catch (err) {
      alert('Error creando reto: ' + err.message);
    } finally {
      setP2pLoading(false);
    }
  };

  const handleAcceptChallenge = async (challengeId) => {
    try {
      const { error } = await supabase
        .from('p2p_challenges')
        .update({ status: 'accepted' })
        .eq('id', challengeId);

      if (error) throw error;
      fetchP2pData();
      alert('¡Reto aceptado! Que gane el mejor.');
    } catch (err) {
      alert('Error al aceptar el reto: ' + err.message);
    }
  };

  const handleRejectChallenge = async (challengeId) => {
    try {
      const { error } = await supabase
        .from('p2p_challenges')
        .update({ status: 'rejected' })
        .eq('id', challengeId);

      if (error) throw error;
      fetchP2pData();
      alert('Reto rechazado.');
    } catch (err) {
      alert('Error al rechazar el reto: ' + err.message);
    }
  };

  // CÁLCULO DE LIDERBOARD SIMULADO
  const getLeaderboardToShow = () => {
    if (!simulatedMode) return leaderboard;

    const pointsMap = {};
    leaderboard.forEach(u => {
      pointsMap[u.id] = 0;
    });

    allPredictionsData.forEach(p => {
      const match = matches.find(m => m.id === p.match_id);
      if (!match) return;

      if (match.status === 'finished') {
        pointsMap[p.user_id] = (pointsMap[p.user_id] || 0) + p.points_earned;
      } else {
        const sim = simulatedScores[match.id];
        if (sim && sim.scoreA !== '' && sim.scoreB !== '' && sim.scoreA !== undefined && sim.scoreB !== undefined) {
          let pts = 0;
          if (p.pred_score_a === sim.scoreA && p.pred_score_b === sim.scoreB) {
            pts = 3;
          } else if (
            Math.sign(p.pred_score_a - p.pred_score_b) === Math.sign(sim.scoreA - sim.scoreB)
          ) {
            pts = 1;
          }
          pointsMap[p.user_id] = (pointsMap[p.user_id] || 0) + pts;
        }
      }
    });

    return leaderboard
      .map(u => ({
        ...u,
        points: pointsMap[u.id] || 0
      }))
      .sort((a, b) => b.points - a.points);
  };

  const handleSimulatedScoreChange = (matchId, team, val) => {
    const cleanVal = val === '' ? '' : parseInt(val, 10);
    if (cleanVal !== '' && isNaN(cleanVal)) return;

    setSimulatedScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team === 'A' ? 'scoreA' : 'scoreB']: cleanVal
      }
    }));
  };

  const handleScoreChange = (matchId, team, val) => {
    const cleanVal = val === '' ? '' : val.replace(/\D/g, '');
    setLocalPreds(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team === 'A' ? 'scoreA' : 'scoreB']: cleanVal === '' ? '' : parseInt(cleanVal, 10)
      }
    }));
  };

  const handleBetAmountChange = (matchId, val) => {
    const cleanVal = val === '' ? '' : val.replace(/\D/g, '');
    setLocalPreds(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        betAmount: cleanVal === '' ? '' : parseInt(cleanVal, 10)
      }
    }));
  };

  const toggleExpandedBets = (matchId) => {
    setExpandedBets(prev => ({
      ...prev,
      [matchId]: !prev[matchId]
    }));
  };

  const handleCreatePool = async (e) => {
    e.preventDefault();
    setActionError('');
    if (!newPoolName.trim()) return;

    try {
      const { data: pool, error: pError } = await supabase
        .from('pools')
        .insert({
          name: newPoolName,
          created_by: user.id,
          entry_fee: parseFloat(newPoolFee) || 0
        })
        .select()
        .single();

      if (pError) throw pError;

      const { error: mError } = await supabase
        .from('pool_members')
        .insert({
          pool_id: pool.id,
          user_id: user.id,
          has_paid: true
        });

      if (mError) throw mError;

      setShowCreatePool(false);
      setNewPoolName('');
      setNewPoolFee('0');
      fetchUserPools();
      alert(`Polla creada. Código: ${pool.invite_code}`);
    } catch (err) {
      setActionError(err.message || 'Error al crear la polla');
    }
  };

  const handleJoinPool = async (e) => {
    e.preventDefault();
    setActionError('');
    const code = joinInviteCode.trim().toLowerCase();
    if (!code) return;

    try {
      const { data: pool, error: pError } = await supabase
        .from('pools')
        .select('*')
        .eq('invite_code', code)
        .single();

      if (pError || !pool) {
        throw new Error('Código no válido.');
      }

      const { error: mError } = await supabase
        .from('pool_members')
        .insert({
          pool_id: pool.id,
          user_id: user.id,
          has_paid: false
        });

      if (mError) {
        if (mError.code === '23505') {
          throw new Error('Ya estás dentro.');
        }
        throw mError;
      }

      setShowJoinPool(false);
      setJoinInviteCode('');
      fetchUserPools();
      alert('Te has unido.');
    } catch (err) {
      setActionError(err.message || 'Error');
    }
  };

  const activeLeaderboard = getLeaderboardToShow();
  const myPainsAndGains = leaderboard.find(item => item.id === user?.id);

  const isMatchLocked = (match) => {
    if (!match) return true;
    return match.status !== 'pending' || new Date(match.match_date) <= new Date();
  };

  return (
    <div className="app-main">
      {/* Confetti Overlay 🎉 */}
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />

      {/* Columna Principal */}
      <div>
        {/* TABS ESCRITORIO */}
        <div className="tabs main-tabs">
          <button 
            className={`tab ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            <Calendar size={18} style={{ marginRight: '6px', display: 'inline-flex', verticalAlign: 'middle' }} />
            Partidos y Apuestas
          </button>
          <button 
            className={`tab ${activeTab === 'custom_bets' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom_bets')}
          >
            <Sparkles size={18} style={{ marginRight: '6px', display: 'inline-flex', verticalAlign: 'middle' }} />
            Apuestas Especiales
          </button>
          <button 
            className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            <Trophy size={18} style={{ marginRight: '6px', display: 'inline-flex', verticalAlign: 'middle' }} />
            Tabla General
          </button>
          <button 
            className={`tab ${activeTab === 'pools' ? 'active' : ''}`}
            onClick={() => setActiveTab('pools')}
          >
            <Users size={18} style={{ marginRight: '6px', display: 'inline-flex', verticalAlign: 'middle' }} />
            Mis Pollas ({pools.length})
          </button>
          <button 
            className={`tab ${activeTab === 'instructions' ? 'active' : ''}`}
            onClick={() => setActiveTab('instructions')}
          >
            <BookOpen size={18} style={{ marginRight: '6px', display: 'inline-flex', verticalAlign: 'middle' }} />
            ¿Cómo Jugar?
          </button>
        </div>

        {/* BOTTOM NAV PARA CELULAR */}
        <div className="bottom-nav">
          <button 
            className={`bottom-nav-item ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
          >
            <Calendar />
            <span>Partidos</span>
          </button>
          <button 
            className={`bottom-nav-item ${activeTab === 'custom_bets' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom_bets')}
          >
            <Sparkles />
            <span>Especiales</span>
          </button>
          <button 
            className={`bottom-nav-item ${activeTab === 'leaderboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('leaderboard')}
          >
            <Trophy />
            <span>Posiciones</span>
          </button>
          <button 
            className={`bottom-nav-item ${activeTab === 'pools' ? 'active' : ''}`}
            onClick={() => setActiveTab('pools')}
          >
            <Users />
            <span>Pollas</span>
          </button>
          <button 
            className={`bottom-nav-item ${activeTab === 'instructions' ? 'active' : ''}`}
            onClick={() => setActiveTab('instructions')}
          >
            <BookOpen />
            <span>Ayuda</span>
          </button>
        </div>

        {/* 1. PARTIDOS */}
        {activeTab === 'matches' && (
          <div className="matches-section">
            {matches.length === 0 ? (
              <div className="glass-container empty-state">
                <Calendar size={48} style={{ marginBottom: '10px', color: 'var(--text-muted)' }} />
                <p>No hay partidos cargados por el administrador todavía.</p>
              </div>
            ) : (
              matches.map(match => {
                const locked = isMatchLocked(match);
                const pred = predictions[match.id];
                const localA = localPreds[match.id]?.scoreA;
                const localB = localPreds[match.id]?.scoreB;
                const localAmount = localPreds[match.id]?.betAmount ?? match.min_bet;
                
                const hasChanged = pred 
                  ? (localA !== pred.pred_score_a || localB !== pred.pred_score_b || localAmount !== pred.bet_amount)
                  : (localA !== undefined && localA !== '' && localB !== undefined && localB !== '');

                const poolSum = matchPoolSums[match.id] || 0;
                const consensus = matchConsensus[match.id];

                return (
                  <div key={match.id} className={`glass-container match-card ${match.status === 'live' ? 'live' : ''}`}>
                    <div className="match-header">
                      <div className="match-date-badge">
                        <Calendar size={14} />
                        {new Date(match.match_date).toLocaleString('es-CO', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '50px', fontWeight: 'bold' }}>
                          Bolsa: ${poolSum.toLocaleString('es-CO')}
                        </span>
                        <div className={`match-status-badge ${match.status}`}>
                          {match.status === 'pending' ? 'Por jugar' : match.status === 'live' ? 'En vivo' : 'Finalizado'}
                        </div>
                      </div>
                    </div>

                    <div className="match-body">
                      <div className="match-team">
                        {renderTeamIcon(match.team_a, match.team_a_icon)}
                        <div className="team-name">{match.team_a}</div>
                      </div>

                      {match.status === 'finished' ? (
                        <div className="match-score-display">
                          <span>{match.score_a}</span>
                          <span className="divider">-</span>
                          <span>{match.score_b}</span>
                        </div>
                      ) : match.status === 'live' ? (
                        <div className="match-score-display">
                          <span style={{ color: 'var(--accent-red)' }}>{match.score_a ?? 0}</span>
                          <span className="divider">-</span>
                          <span style={{ color: 'var(--accent-red)' }}>{match.score_b ?? 0}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>VS</div>
                      )}

                      <div className="match-team">
                        {renderTeamIcon(match.team_b, match.team_b_icon)}
                        <div className="team-name">{match.team_b}</div>
                      </div>
                    </div>

                    {/* Consenso Bar */}
                    {consensus && (
                      <div className="consenso-container">
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>Gana {match.team_a}: {consensus.a}%</span>
                          <span>Empate: {consensus.draw}%</span>
                          <span>Gana {match.team_b}: {consensus.b}%</span>
                        </div>
                        <div className="consenso-bar">
                          <div className="consenso-segment" style={{ width: `${consensus.a}%`, background: 'var(--primary)' }}></div>
                          <div className="consenso-segment" style={{ width: `${consensus.draw}%`, background: 'rgba(255,255,255,0.2)' }}></div>
                          <div className="consenso-segment" style={{ width: `${consensus.b}%`, background: 'var(--accent-blue)' }}></div>
                        </div>
                      </div>
                    )}

                    {/* Ganancia Estimada en Vivo */}
                    {pred && (
                      <div style={{
                        background: 'rgba(16, 185, 129, 0.05)',
                        border: '1px solid rgba(16, 185, 129, 0.15)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        marginBottom: '15px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Tu pronóstico:</span>
                          <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                            {pred.pred_score_a} - {pred.pred_score_b} (${pred.bet_amount?.toLocaleString()} COP)
                          </span>
                        </div>
                        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }}></div>
                        {(() => {
                          const matchBets = allPredictionsData.filter(p => p.match_id === match.id);
                          const totalPool = matchBets.reduce((sum, p) => sum + (p.bet_amount || 0), 0);
                          
                          // exact match count
                          const exactCount = matchBets.filter(p => p.pred_score_a === pred.pred_score_a && p.pred_score_b === pred.pred_score_b).length;
                          const estExactWin = exactCount > 0 ? (totalPool / exactCount) : totalPool;

                          // outcome count
                          const predOutcome = pred.pred_score_a > pred.pred_score_b ? 'A' : pred.pred_score_a < pred.pred_score_b ? 'B' : 'D';
                          const outcomeCount = matchBets.filter(p => {
                            const outcome = p.pred_score_a > p.pred_score_b ? 'A' : p.pred_score_a < p.pred_score_b ? 'B' : 'D';
                            return outcome === predOutcome;
                          }).length;
                          const estOutcomeWin = outcomeCount > 0 ? (totalPool / outcomeCount) : totalPool;

                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Ganancia est. (marcador exacto):</span>
                                <span style={{ fontWeight: 'bold', color: '#fbbf24' }}>
                                  ${Math.round(estExactWin).toLocaleString()} COP
                                </span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Ganancia est. (solo ganador/empate):</span>
                                <span style={{ color: 'var(--accent-blue)' }}>
                                  ${Math.round(estOutcomeWin).toLocaleString()} COP
                                </span>
                              </div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px', textAlign: 'right' }}>
                                *Estimación dinámica en vivo. Cambia a medida que otros apuestan.
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Apuesta inputs */}
                    <div className="prediction-footer" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Marcador</span>
                          <div className="prediction-inputs" style={{ padding: '4px 8px' }}>
                            <input
                              type="text"
                              maxLength="2"
                              inputMode="numeric"
                              className="prediction-input"
                              style={{ width: '36px', height: '36px', fontSize: '1.2rem' }}
                              value={localA !== undefined ? localA : ''}
                              onChange={(e) => handleScoreChange(match.id, 'A', e.target.value)}
                              disabled={locked}
                              placeholder="-"
                            />
                            <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>:</span>
                            <input
                              type="text"
                              maxLength="2"
                              inputMode="numeric"
                              className="prediction-input"
                              style={{ width: '36px', height: '36px', fontSize: '1.2rem' }}
                              value={localB !== undefined ? localB : ''}
                              onChange={(e) => handleScoreChange(match.id, 'B', e.target.value)}
                              disabled={locked}
                              placeholder="-"
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Apostar ($)</span>
                          <div className="prediction-inputs" style={{ padding: '4px 8px', width: '120px' }}>
                            <DollarSign size={14} style={{ color: 'var(--text-muted)' }} />
                            <input
                              type="number"
                              className="prediction-input"
                              style={{ width: '100%', height: '36px', fontSize: '1rem', border: 'none', background: 'transparent' }}
                              value={localAmount}
                              onChange={(e) => handleBetAmountChange(match.id, e.target.value)}
                              disabled={locked}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          <span>Min: ${match.min_bet?.toLocaleString()}</span>
                          <span>Max: ${match.max_bet?.toLocaleString()}</span>
                        </div>

                        <div>
                          {locked ? (
                            <div className="prediction-status-msg" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Lock size={14} style={{ color: 'var(--text-muted)' }} />
                                <span>Cerrado</span>
                              </div>
                              {pred && match.status === 'finished' && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                                  <span className="points-badge">+{pred.points_earned} pts</span>
                                  {pred.gain > 0 && (
                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                                      Ganaste: ${pred.gain.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="btn btn-primary"
                                style={{ padding: '8px 16px', width: 'auto', fontSize: '0.85rem' }}
                                disabled={!hasChanged || savingPreds[match.id]}
                                onClick={() => savePrediction(match.id, match)}
                              >
                                {savingPreds[match.id] ? '...' : pred ? 'Actualizar' : 'Apostar'}
                              </button>
                              {match.status === 'pending' && (
                                <button
                                  className="btn btn-secondary"
                                  style={{
                                    padding: '8px 12px',
                                    width: 'auto',
                                    fontSize: '0.85rem',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    color: '#f87171',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                  }}
                                  onClick={() => {
                                    setP2pMatchId(match.id);
                                    setActiveTab('custom_bets');
                                    setActiveSpecialSubTab('p2p');
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  title="Retar a un compañero a un duelo 1v1 en este partido"
                                >
                                  <Zap size={14} /> Retar
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                      </div>

                      {/* ACORDEÓN DE COMPAÑEROS APOSTADORES EN EL PARTIDO */}
                      {(() => {
                        const matchBets = allPredictionsData.filter(p => p.match_id === match.id);
                        if (matchBets.length === 0) return null;

                        return (
                          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                            <button
                              className="btn btn-secondary"
                              style={{
                                width: '100%',
                                padding: '8px 12px',
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                borderRadius: '6px'
                              }}
                              onClick={() => toggleExpandedBets(match.id)}
                            >
                              <Users size={14} style={{ color: 'var(--primary)' }} />
                              {expandedBets[match.id] ? 'Ocultar predicciones de compañeros' : `Ver predicciones de compañeros (${matchBets.length})`}
                            </button>

                            {expandedBets[match.id] && (
                              <div style={{
                                marginTop: '10px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px',
                                maxHeight: '200px',
                                overflowY: 'auto',
                                padding: '4px',
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '6px'
                              }}>
                                {matchBets.map(bet => {
                                  const prof = leaderboard.find(l => l.id === bet.user_id);
                                  return (
                                    <div
                                      key={bet.user_id}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '8px 10px',
                                        background: 'rgba(255,255,255,0.02)',
                                        borderRadius: '4px',
                                        fontSize: '0.8rem',
                                        borderLeft: '3px solid var(--primary)'
                                      }}
                                    >
                                      <div>
                                        <span style={{ fontWeight: 'bold', color: 'white' }}>{prof?.display_name || 'Compañero'}</span>
                                        {prof?.department && (
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px' }}>({prof.department})</span>
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>${bet.bet_amount?.toLocaleString('es-CO')}</span>
                                        <span style={{
                                          fontWeight: 'bold',
                                          color: 'var(--primary)',
                                          background: 'rgba(16, 185, 129, 0.1)',
                                          padding: '2px 8px',
                                          borderRadius: '4px'
                                        }}>
                                          {bet.pred_score_a} : {bet.pred_score_b}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 2. APUESTAS ESPECIALES & RETOS 1v1 */}
        {activeTab === 'custom_bets' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="admin-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
              <button 
                className={`tab ${activeSpecialSubTab === 'specials' ? 'active' : ''}`}
                onClick={() => setActiveSpecialSubTab('specials')}
                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
              >
                Especiales Aprobadas
              </button>
              <button 
                className={`tab ${activeSpecialSubTab === 'p2p' ? 'active' : ''}`}
                onClick={() => setActiveSpecialSubTab('p2p')}
                style={{ fontSize: '0.85rem', padding: '8px 16px' }}
              >
                Duelos 1v1
              </button>
            </div>

            {activeSpecialSubTab === 'specials' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="glass-container" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles style={{ color: 'var(--secondary)' }} /> Sugerir Apuesta Especial
                  </h3>
                  <form onSubmit={handleSuggestCustomBet} style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Ej: ¿Habrá tarjeta roja en la final?, ¿Quién mete el primer gol?"
                      value={suggestTitle}
                      onChange={(e) => setSuggestTitle(e.target.value)}
                      required
                    />
                    <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '10px 20px' }} disabled={suggestLoading}>
                      Enviar
                    </button>
                  </form>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {customBets.length === 0 ? (
                    <div className="glass-container empty-state">
                      <p>No hay apuestas especiales disponibles.</p>
                    </div>
                  ) : (
                    customBets.map(bet => {
                      const resolved = bet.resolved_result !== null && bet.resolved_result !== '';
                      const pred = customPredictions[bet.id];
                      const localVal = localCustomPreds[bet.id]?.predictionValue || '';
                      const localAmt = localCustomPreds[bet.id]?.betAmount ?? bet.min_bet;
                      const poolSum = customBetPoolSums[bet.id] || 0;
                      const hasChanged = pred ? (localVal !== pred.prediction_value || localAmt !== pred.bet_amount) : (localVal !== '');

                      return (
                        <div key={bet.id} className="glass-container" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                            <div>
                              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white' }}>"{bet.title}"</h3>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Propuesto por: {bet.profiles?.display_name}</span>
                            </div>
                            <span style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '50px', fontWeight: 'bold' }}>
                              Bolsa: ${poolSum.toLocaleString()}
                            </span>
                          </div>

                          {/* Ganancia Estimada en Vivo para Especiales */}
                          {pred && (
                            <div style={{
                              background: 'rgba(16, 185, 129, 0.05)',
                              border: '1px solid rgba(16, 185, 129, 0.15)',
                              borderRadius: '8px',
                              padding: '10px 14px',
                              fontSize: '0.85rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Tu pronóstico:</span>
                                <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                                  "{pred.prediction_value}" (${pred.bet_amount?.toLocaleString()} COP)
                                </span>
                              </div>
                              <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }}></div>
                              {(() => {
                                const betPredictions = allCustomPredictionsData.filter(p => p.custom_bet_id === bet.id);
                                const totalPool = betPredictions.reduce((sum, p) => sum + (p.bet_amount || 0), 0);
                                
                                // same value count
                                const sameValueCount = betPredictions.filter(p => p.prediction_value === pred.prediction_value).length;
                                const estWin = sameValueCount > 0 ? (totalPool / sameValueCount) : totalPool;

                                return (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: 'var(--text-muted)' }}>Ganancia est. (si aciertas):</span>
                                      <span style={{ fontWeight: 'bold', color: '#fbbf24' }}>
                                        ${Math.round(estWin).toLocaleString()} COP
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px', textAlign: 'right' }}>
                                      *Estimación dinámica en vivo. Cambia a medida que otros apuestan.
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}

                          <div className="prediction-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', flex: '1' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '130px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Respuesta</span>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ padding: '6px 12px', fontSize: '0.9rem' }}
                                  value={localVal}
                                  onChange={(e) => handleCustomPredictionValueChange(bet.id, e.target.value)}
                                  disabled={resolved}
                                />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '110px' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dinero ($)</span>
                                <div className="prediction-inputs" style={{ padding: '4px 8px' }}>
                                  <DollarSign size={14} style={{ color: 'var(--text-muted)' }} />
                                  <input
                                    type="number"
                                    className="prediction-input"
                                    style={{ width: '100%', height: '28px', fontSize: '1rem', border: 'none', background: 'transparent' }}
                                    value={localAmt}
                                    onChange={(e) => handleCustomBetAmountChange(bet.id, e.target.value)}
                                    disabled={resolved}
                                  />
                                </div>
                              </div>
                            </div>
                            <div>
                              {resolved ? (
                                <div style={{ fontSize: '0.85rem', textAlign: 'right' }}>
                                  <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Ganador: "{bet.resolved_result}"</span>
                                  {pred && <div>{pred.gain > 0 ? `Ganaste: $${pred.gain.toLocaleString()}` : 'Sin acierto'}</div>}
                                </div>
                              ) : (
                                <button className="btn btn-primary" style={{ padding: '8px 16px', width: 'auto', fontSize: '0.85rem' }} disabled={!hasChanged} onClick={() => saveCustomPrediction(bet.id, bet)}>
                                  Guardar
                                </button>
                              )}
                            </div>
                          </div>

                          {/* ACORDEÓN DE COMPAÑEROS APOSTADORES EN APUESTA ESPECIAL */}
                          {(() => {
                            const betPredictions = allCustomPredictionsData.filter(p => p.custom_bet_id === bet.id);
                            if (betPredictions.length === 0) return null;

                            return (
                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
                                <button
                                  className="btn btn-secondary"
                                  style={{
                                    width: '100%',
                                    padding: '6px 12px',
                                    fontSize: '0.75rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.05)',
                                    borderRadius: '6px'
                                  }}
                                  onClick={() => toggleExpandedBets(`custom-${bet.id}`)}
                                >
                                  <Users size={12} style={{ color: 'var(--secondary)' }} />
                                  {expandedBets[`custom-${bet.id}`] ? 'Ocultar apuestas de compañeros' : `Ver apuestas de compañeros (${betPredictions.length})`}
                                </button>

                                {expandedBets[`custom-${bet.id}`] && (
                                  <div style={{
                                    marginTop: '10px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    maxHeight: '150px',
                                    overflowY: 'auto',
                                    padding: '4px',
                                    background: 'rgba(0,0,0,0.2)',
                                    borderRadius: '6px'
                                  }}>
                                    {betPredictions.map(p => {
                                      const prof = leaderboard.find(l => l.id === p.user_id);
                                      return (
                                        <div
                                          key={p.user_id}
                                          style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '6px 10px',
                                            background: 'rgba(255,255,255,0.02)',
                                            borderRadius: '4px',
                                            fontSize: '0.75rem',
                                            borderLeft: '3px solid var(--secondary)'
                                          }}
                                        >
                                          <div>
                                            <span style={{ fontWeight: 'bold', color: 'white' }}>{prof?.display_name || 'Compañero'}</span>
                                            {prof?.department && (
                                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '6px' }}>({prof.department})</span>
                                            )}
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>${p.bet_amount?.toLocaleString('es-CO')}</span>
                                            <span style={{
                                              fontWeight: 'bold',
                                              color: 'var(--secondary)',
                                              background: 'rgba(251, 191, 36, 0.1)',
                                              padding: '2px 6px',
                                              borderRadius: '4px'
                                            }}>
                                              {p.prediction_value}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {activeSpecialSubTab === 'p2p' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted' && (
                  <div style={{
                    background: 'rgba(251, 191, 36, 0.05)',
                    border: '1px solid rgba(251, 191, 36, 0.15)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Bell style={{ color: 'var(--secondary)' }} size={16} />
                      <span>Habilita las notificaciones flotantes para enterarte al instante cuando te retan.</span>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '0.75rem' }}
                      onClick={() => {
                        Notification.requestPermission().then(permission => {
                          if (permission === 'granted') {
                            alert('¡Notificaciones activadas con éxito!');
                            window.location.reload();
                          }
                        });
                      }}
                    >
                      Activar Notificaciones
                    </button>
                  </div>
                )}

                <div className="glass-container" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PlusCircle style={{ color: 'var(--primary)' }} /> Lanzar un Duelo 1v1
                  </h3>
                  <form onSubmit={handleCreateChallenge} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', alignItems: 'end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Rival</label>
                      <select className="form-input" value={p2pOpponentId} onChange={(e) => setP2pOpponentId(e.target.value)} required>
                        <option value="">Selecciona...</option>
                        {allProfiles.map(p => <option key={p.id} value={p.id}>{p.display_name} ({p.department})</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Partido</label>
                      <select className="form-input" value={p2pMatchId} onChange={(e) => setP2pMatchId(e.target.value)} required>
                        <option value="">Selecciona...</option>
                        {matches.filter(m => m.status === 'pending').map(m => <option key={m.id} value={m.id}>{m.team_a} vs {m.team_b}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Tu Predicción</label>
                      <select className="form-input" value={p2pPrediction} onChange={(e) => setP2pPrediction(e.target.value)} required>
                        <option value="team_a">Gana Local</option>
                        <option value="team_b">Gana Visitante</option>
                        <option value="draw">Empate</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Dinero ($)</label>
                      <input type="number" className="form-input" value={p2pAmount} onChange={(e) => setP2pAmount(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ height: '45px' }} disabled={p2pLoading}>Retar</button>
                  </form>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {p2pChallenges.map(challenge => {
                    const isMeChallenger = challenge.challenger_id === user.id;
                    const opponentName = isMeChallenger ? challenge.challenged?.display_name : challenge.challenger?.display_name;
                    const myPredictionText = challenge.challenger_prediction === 'team_a' ? 'Gana local' : challenge.challenger_prediction === 'team_b' ? 'Gana visitante' : 'Empate';
                    const matchText = challenge.matches ? `${challenge.matches.team_a} vs ${challenge.matches.team_b}` : 'Partido';

                    return (
                      <div key={challenge.id} className="glass-container" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', color: 'white' }}>Duelo contra <strong>{opponentName}</strong></div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>Partido: {matchText} | Monto: <strong>${challenge.amount?.toLocaleString()}</strong></div>
                        </div>
                        <div>
                          {challenge.status === 'pending' ? (
                            !isMeChallenger ? (
                              <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="btn btn-primary" style={{ padding: '6px 12px', width: 'auto', fontSize: '0.8rem' }} onClick={() => handleAcceptChallenge(challenge.id)}>Aceptar</button>
                                <button className="btn btn-secondary" style={{ padding: '6px 12px', width: 'auto', fontSize: '0.8rem', color: 'var(--accent-red)' }} onClick={() => handleRejectChallenge(challenge.id)}>Rechazar</button>
                              </div>
                            ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Enviado...</span>
                          ) : challenge.status === 'accepted' ? (
                            <span style={{ color: 'var(--secondary)', fontSize: '0.85rem', fontWeight: 'bold' }}>Activo</span>
                          ) : challenge.status === 'rejected' ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Rechazado</span>
                          ) : (
                            <div style={{ fontSize: '0.85rem', textAlign: 'right' }}>
                              <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Resuelto</span><br />
                              <span>Ganador: <strong>{challenge.winner_id === user.id ? 'Tú (+$' + challenge.amount.toLocaleString() + ')' : opponentName}</strong></span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. TABLA GENERAL CON SIMULADOR */}
        {activeTab === 'leaderboard' && (
          <div className="glass-container leaderboard-card">
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
              <h2 className="leaderboard-title" style={{ marginBottom: 0 }}>
                <Trophy style={{ color: 'var(--secondary)' }} /> Tabla General
              </h2>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Switch Simulador */}
                <button
                  className={`btn ${simulatedMode ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => {
                    setSimulatedMode(!simulatedMode);
                    if (!simulatedMode) setSimulatedScores({});
                  }}
                >
                  <Activity size={14} /> {simulatedMode ? 'Desactivar Simulador' : 'Simulador'}
                </button>

                <div className="admin-tabs" style={{ marginBottom: 0, padding: '2px' }}>
                  <button className={`tab ${leaderboardSubTab === 'users' ? 'active' : ''}`} onClick={() => setLeaderboardSubTab('users')} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Individual</button>
                  <button className={`tab ${leaderboardSubTab === 'depts' ? 'active' : ''}`} onClick={() => setLeaderboardSubTab('depts')} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Áreas</button>
                </div>
              </div>
            </div>

            {/* Simulador Inputs */}
            {simulatedMode && leaderboardSubTab === 'users' && (
              <div style={{ background: 'rgba(251, 191, 36, 0.05)', border: '1px solid rgba(251, 191, 36, 0.15)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                <h4 style={{ color: 'var(--secondary)', fontWeight: 'bold', fontSize: '0.9rem', marginBottom: '8px' }}>🔮 Modo Simulador Activo</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  Ingresa marcadores ficticios para los próximos partidos para ver cómo cambiaría la clasificación del personal de forma instantánea.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                  {matches.filter(m => m.status === 'pending').map(match => {
                    const sim = simulatedScores[match.id] || { scoreA: '', scoreB: '' };
                    return (
                      <div key={match.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                        <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.team_a}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input type="text" maxLength="1" className="prediction-input" style={{ width: '28px', height: '28px', fontSize: '0.9rem', padding: 0 }} value={sim.scoreA} onChange={(e) => handleSimulatedScoreChange(match.id, 'A', e.target.value)} placeholder="-" />
                          <span>:</span>
                          <input type="text" maxLength="1" className="prediction-input" style={{ width: '28px', height: '28px', fontSize: '0.9rem', padding: 0 }} value={sim.scoreB} onChange={(e) => handleSimulatedScoreChange(match.id, 'B', e.target.value)} placeholder="-" />
                        </div>
                        <span style={{ maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{match.team_b}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Render Tablas */}
            {leaderboardSubTab === 'users' ? (
              <div className="leaderboard-list">
                {activeLeaderboard.map((item, index) => (
                  <div key={item.id} className="leaderboard-item" style={item.id === user.id ? { border: '1px solid var(--primary)', background: 'rgba(16, 185, 129, 0.05)' } : {}}>
                    <div className="leaderboard-user">
                      <span className={`leaderboard-rank rank-${index + 1}`}>{index + 1}</span>
                      <div className="avatar-circle" style={index === 0 ? { background: 'var(--secondary)' } : {}}>{item.display_name.substring(0,2).toUpperCase()}</div>
                      <div>
                        <span className="leaderboard-name">{item.display_name} {item.id === user.id && '(Tú)'}</span>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Área: {item.department}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="leaderboard-points" style={{ display: 'block' }}>{item.points} pts</span>
                      {!simulatedMode && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ganado: ${item.totalGain?.toLocaleString()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="leaderboard-list">
                {deptLeaderboard.map((item, index) => (
                  <div key={item.name} className="leaderboard-item" style={profile?.department === item.name ? { border: '1px solid var(--primary)', background: 'rgba(16, 185, 129, 0.05)' } : {}}>
                    <div className="leaderboard-user">
                      <span className={`leaderboard-rank rank-${index + 1}`}>{index + 1}</span>
                      <div className="avatar-circle">{item.name.substring(0,2).toUpperCase()}</div>
                      <div>
                        <span className="leaderboard-name">Área: {item.name}</span>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.members} miembros</span>
                      </div>
                    </div>
                    <span className="leaderboard-points">{item.points} pts (Promedio)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. MIS POLLAS */}
        {activeTab === 'pools' && (
          <div>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
              <button className="btn btn-primary" onClick={() => setShowCreatePool(true)} style={{ flex: 1 }}><PlusCircle size={18} /> Crear Polla</button>
              <button className="btn btn-secondary" onClick={() => setShowJoinPool(true)} style={{ flex: 1 }}><LogIn size={18} /> Unirse con Código</button>
            </div>
            <div className="pools-grid">
              {pools.map(pool => (
                <div key={pool.id} className="glass-container pool-card">
                  <div className="pool-info">
                    <h3>{pool.name}</h3>
                    <span className="pool-stat"><Users size={14} /> {pool.pool_members?.length} participantes</span>
                    <span className="pool-stat"><DollarSign size={14} /> Inscripción: <strong>${pool.entry_fee.toLocaleString()}</strong></span>
                    <span className="pool-stat" style={{ marginTop: '10px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px', display: 'inline-flex' }}>
                      Código: <strong style={{ color: 'var(--secondary)', marginLeft: '4px' }}>{pool.invite_code}</strong>
                    </span>
                  </div>
                  <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => onSelectPool(pool.id)}>Ver Clasificación</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. INSTRUCTIVO */}
        {activeTab === 'instructions' && <Instructions isAdmin={profile?.is_admin} />}
      </div>

      {/* Columna Lateral (Perfil + Muro de Burlas General) */}
      <div className="desktop-only" style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
        <div className="glass-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '15px' }}>
          <div className="avatar-circle" style={{ width: '64px', height: '64px', fontSize: '1.8rem', fontWeight: 800 }}>{profile?.display_name?.substring(0,2).toUpperCase()}</div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{profile?.display_name}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{user?.email}</p>
            <p style={{ color: 'var(--primary)', fontSize: '0.85rem', fontWeight: 'bold' }}>Área: {profile?.department}</p>
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', width: '100%', paddingTop: '15px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{myPainsAndGains?.points || 0}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Puntos</div>
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--secondary)' }}>${myPainsAndGains?.totalGain?.toLocaleString() || 0}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ganado ($)</div>
            </div>
          </div>
        </div>

        {/* Muro de Burlas en vivo general */}
        <ChatWall />
      </div>
    </div>
  );
}
