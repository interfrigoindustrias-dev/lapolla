import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { Send, MessageSquare } from 'lucide-react';

export default function ChatWall({ matchId = null }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetchMessages();

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel(`chat_messages:${matchId || 'general'}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages' 
      }, async (payload) => {
        const msg = payload.new;
        
        // Verificar que coincida con el matchId
        if (msg.match_id === matchId) {
          // Obtener nombre del perfil
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', msg.user_id)
            .single();

          const enrichedMsg = {
            ...msg,
            profiles: profile
          };

          setMessages(prev => {
            // Prevenir duplicados por si acaso
            if (prev.some(m => m.id === enrichedMsg.id)) return prev;
            return [...prev, enrichedMsg];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  useEffect(() => {
    // Auto-scroll al final del chat al recibir mensajes
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      let query = supabase
        .from('chat_messages')
        .select(`
          *,
          profiles:user_id (display_name)
        `)
        .order('created_at', { ascending: true });

      if (matchId) {
        query = query.eq('match_id', matchId);
      } else {
        query = query.is('match_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Error cargando chat:', err);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    const text = inputText.trim();
    setInputText('');
    setLoading(true);

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          user_id: user.id,
          match_id: matchId,
          message: text
        });

      if (error) throw error;
    } catch (err) {
      console.error('Error enviando mensaje:', err);
      alert('No se pudo enviar el mensaje.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '400px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      {/* Header del Chat */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MessageSquare size={16} style={{ color: 'var(--primary)' }} />
        <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
          {matchId ? 'Muro de Burlas del Partido' : 'Muro de Burlas General'}
        </span>
      </div>

      {/* Lista de Mensajes */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {messages.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: 'auto' }}>
            ¡Nadie ha hablado aún! Sé el primero en mandar una burla.
          </p>
        ) : (
          messages.map(msg => {
            const isMe = msg.user_id === user.id;
            return (
              <div 
                key={msg.id} 
                style={{ 
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isMe ? 'flex-end' : 'flex-start'
                }}
              >
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', padding: '0 4px' }}>
                  {msg.profiles?.display_name || 'Compañero'}
                </span>
                <div style={{ 
                  padding: '10px 14px', 
                  borderRadius: '16px', 
                  borderTopRightRadius: isMe ? '2px' : '16px',
                  borderTopLeftRadius: isMe ? '16px' : '2px',
                  background: isMe ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                  color: isMe ? 'var(--text-dark)' : 'white',
                  fontWeight: isMe ? '600' : 'normal',
                  fontSize: '0.9rem',
                  lineHeight: '1.4',
                  wordBreak: 'break-word',
                  boxShadow: isMe ? '0 2px 10px var(--primary-glow)' : 'none'
                }}>
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Inputs Form */}
      <form onSubmit={handleSendMessage} style={{ padding: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.1)' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Escribe tu comentario o burla..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          required
          style={{ height: '38px', padding: '8px 12px', fontSize: '0.9rem' }}
        />
        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '38px', height: '38px', padding: 0, borderRadius: '50%' }}
          disabled={loading || !inputText.trim()}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
