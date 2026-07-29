import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const STORAGE_KEY = 'pc-trader-chat-history-v1';

function readLocalMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalMessages(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // ignore storage errors
  }
}

/**
 * useChatHistory — loads and manages the single-thread conversation.
 * It prefers Supabase when available, then falls back to browser storage so the chat keeps working locally.
 */
export function useChatHistory() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMessages = useCallback(async () => {
    const fallbackMessages = readLocalMessages();
    setMessages(fallbackMessages);
    setLoading(true);

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: true });

        if (!error && Array.isArray(data) && data.length) {
          const normalized = data.map((msg) => ({
            id: msg.id,
            role: msg.role || 'model',
            text: msg.content || msg.text || '',
            created: msg.created_at || new Date().toISOString(),
          }));
          setMessages(normalized);
          writeLocalMessages(normalized);
          setError(null);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Supabase chat history unavailable:', err);
    }

    setMessages(fallbackMessages);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const addMessage = useCallback(async (role, text) => {
    const newMsg = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role,
      text,
      created: new Date().toISOString(),
    };

    setMessages((prev) => {
      const next = [...prev, newMsg];
      writeLocalMessages(next);
      return next;
    });

    try {
      if (supabase) {
        const { error } = await supabase.from('chat_messages').insert([
          { role, content: text, created_at: new Date().toISOString() },
        ]);
        if (!error) return newMsg;
      }
    } catch (err) {
      console.warn('Supabase chat save unavailable:', err);
    }

    return newMsg;
  }, []);

  const formattedHistory = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }));

  return { messages, formattedHistory, loading, error, addMessage };
}
