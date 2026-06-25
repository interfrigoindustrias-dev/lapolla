import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { ArrowLeft, Users, Trophy, DollarSign, CheckCircle2, XCircle } from 'lucide-react';

export default function PoolDetail({ poolId, onBack }) {
  const { user, profile } = useAuth();
  const [pool, setPool] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPoolDetails();
  }, [poolId]);

  const fetchPoolDetails = async () => {
    setLoading(true);
    try {
      // 1. Cargar info de la polla
      const { data: poolData, error: pError } = await supabase
        .from('pools')
        .select(`
          *,
          profiles:created_by (display_name)
        `)
        .eq('id', poolId)
        .single();

      if (pError) throw pError;
      setPool(poolData);

      // 2. Cargar los miembros y sus perfiles
      const { data: membersData, error: mError } = await supabase
        .from('pool_members')
        .select(`
          *,
          profiles:user_id (id, display_name)
        `)
        .eq('pool_id', poolId);

      if (mError) throw mError;

      // 3. Obtener todas las predicciones de estos miembros para calcular sus puntos en tiempo real
      const memberIds = membersData.map(m => m.user_id);
      
      let pointsMap = {};
      if (memberIds.length > 0) {
        const { data: predsData, error: prError } = await supabase
          .from('predictions')
          .select('user_id, points_earned')
          .in('user_id', memberIds);

        if (prError) throw prError;

        predsData?.forEach(p => {
          pointsMap[p.user_id] = (pointsMap[p.user_id] || 0) + p.points_earned;
        });
      }

      // Combinar los datos
      const sortedMembers = membersData.map(m => ({
        id: m.id,
        user_id: m.user_id,
        display_name: m.profiles?.display_name || 'Usuario',
        has_paid: m.has_paid,
        joined_at: m.joined_at,
        points: pointsMap[m.user_id] || 0
      })).sort((a, b) => b.points - a.points);

      setMembers(sortedMembers);
    } catch (err) {
      console.error('Error cargando detalles de la polla:', err);
      alert('Error cargando la polla');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePayment = async (member) => {
    // Solo el creador de la polla o el administrador general pueden alternar el pago
    const isCreator = pool.created_by === user.id;
    const isAdmin = profile?.is_admin === true;

    if (!isCreator && !isAdmin) {
      alert('Solo el creador de esta polla o el administrador de la plataforma pueden cambiar el estado de pago.');
      return;
    }

    const newPaymentStatus = !member.has_paid;

    try {
      const { error } = await supabase
        .from('pool_members')
        .update({ has_paid: newPaymentStatus })
        .eq('id', member.id);

      if (error) throw error;
      
      // Actualizar localmente
      setMembers(prev => prev.map(m => {
        if (m.id === member.id) {
          return { ...m, has_paid: newPaymentStatus };
        }
        return m;
      }));

    } catch (err) {
      console.error('Error al actualizar pago:', err);
      alert('No se pudo actualizar el estado de pago.');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <p>Cargando detalles de la polla...</p>
      </div>
    );
  }

  if (!pool) {
    return (
      <div className="glass-container empty-state">
        <p>No se encontró la polla seleccionada.</p>
        <button className="btn btn-primary" onClick={onBack} style={{ marginTop: '15px' }}>
          Volver
        </button>
      </div>
    );
  }

  const isCreatorOrAdmin = pool.created_by === user.id || profile?.is_admin;
  const paidMembersCount = members.filter(m => m.has_paid).length;
  const totalCollected = paidMembersCount * pool.entry_fee;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', gridColumn: '1 / -1' }}>
      {/* Botón Volver y Título */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
        <button 
          onClick={onBack} 
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-main)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '1rem'
          }}
        >
          <ArrowLeft size={20} /> Volver a Pollas
        </button>

        <span style={{ fontSize: '0.85rem', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '50px' }}>
          Código de Invitación: <strong style={{ color: 'var(--secondary)' }}>{pool.invite_code}</strong>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '25px' }}>
        {/* Ficha Resumen de la Polla */}
        <div className="glass-container" style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white', marginBottom: '5px' }}>{pool.name}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Creada por: <strong>{pool.profiles?.display_name || 'Organizador'}</strong></p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Users size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{members.length}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Miembros</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(251, 191, 36, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--secondary)' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>${pool.entry_fee.toLocaleString('es-CO')}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Inscripción</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-blue)' }}>
              <DollarSign size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>${totalCollected.toLocaleString('es-CO')}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Pozo Acumulado</div>
            </div>
          </div>
        </div>

        {/* Clasificación de la Polla */}
        <div className="glass-container" style={{ padding: '24px' }}>
          <h2 className="leaderboard-title" style={{ marginBottom: '20px' }}>
            <Trophy style={{ color: 'var(--secondary)' }} />
            Clasificación del Grupo
          </h2>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 10px', width: '60px' }}>Puesto</th>
                  <th style={{ padding: '12px 10px' }}>Participante</th>
                  <th style={{ padding: '12px 10px', width: '100px' }}>Puntos</th>
                  <th style={{ padding: '12px 10px', width: '140px' }}>Estado Pago</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, index) => {
                  const isCurrentUser = member.user_id === user.id;
                  
                  return (
                    <tr 
                      key={member.id} 
                      style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        background: isCurrentUser ? 'rgba(16, 185, 129, 0.03)' : 'transparent',
                        fontWeight: isCurrentUser ? 'bold' : 'normal'
                      }}
                    >
                      <td style={{ padding: '14px 10px', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                        <span className={`leaderboard-rank rank-${index + 1}`}>{index + 1}</span>
                      </td>
                      <td style={{ padding: '14px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="avatar-circle" style={{ width: '28px', height: '28px', fontSize: '0.75rem' }}>
                            {member.display_name.substring(0, 2).toUpperCase()}
                          </div>
                          <span>{member.display_name} {isCurrentUser && '(Tú)'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 10px', color: 'var(--primary)', fontWeight: 800 }}>
                        {member.points} pts
                      </td>
                      <td style={{ padding: '14px 10px' }}>
                        {isCreatorOrAdmin ? (
                          <button
                            onClick={() => handleTogglePayment(member)}
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
                              color: member.has_paid ? 'var(--primary)' : 'var(--text-muted)'
                            }}
                            title="Haz clic para cambiar el estado de pago"
                          >
                            {member.has_paid ? (
                              <>
                                <CheckCircle2 size={16} style={{ color: 'var(--primary)' }} />
                                <span style={{ color: 'var(--primary)' }}>Pagado</span>
                              </>
                            ) : (
                              <>
                                <XCircle size={16} style={{ color: 'var(--text-muted)' }} />
                                <span>Pendiente</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                            {member.has_paid ? (
                              <>
                                <CheckCircle2 size={16} style={{ color: 'var(--primary)' }} />
                                <span style={{ color: 'var(--primary)' }}>Pagado</span>
                              </>
                            ) : (
                              <>
                                <XCircle size={16} style={{ color: 'var(--text-muted)' }} />
                                <span style={{ color: 'var(--text-muted)' }}>Pendiente</span>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
