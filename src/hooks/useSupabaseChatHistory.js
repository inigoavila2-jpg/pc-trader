import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Compatibility hook. The main useChatHistory hook handles the actual
 * cloud loading and realtime synchronization.
 */
export function useSupabaseChatHistory() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadMessages() {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .order('created_at', { ascending: true });

      if (!error && active) setMessages(data ?? []);
      setLoading(false);
    }

    loadMessages();

    const channel = supabase
      .channel('pc-trader-shared-chat-compat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          if (!active) return;
          setMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(payload.new.id))) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const addMessage = async (role, content) => {
    if (!supabase) {
      return { data: null, error: new Error('Supabase is not configured.') };
    }

    return supabase
      .from('chat_messages')
      .insert([{ role, content }])
      .select('id, role, content, created_at');
  };

  return { messages, loading, addMessage };
}
