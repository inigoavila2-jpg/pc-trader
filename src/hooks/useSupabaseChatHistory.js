import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useSupabaseChatHistory() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMessages() {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error) {
        setMessages(data ?? []);
      }
      setLoading(false);
    }

    loadMessages();
  }, []);

  const addMessage = async (role, content, userId = null) => {
    const { data, error } = await supabase.from('chat_messages').insert([
      { role, content, user_id: userId },
    ]);

    if (!error) {
      setMessages((prev) => [...prev, ...(data ?? [])]);
    }

    return { data, error };
  };

  return { messages, loading, addMessage };
}
