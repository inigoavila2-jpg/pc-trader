import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const STORAGE_KEY = 'pc-trader-chat-history-v2';

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
  } catch {}
}

function normalizeMessage(msg) {
  return {
    id: msg.id,
    role: msg.role || 'model',
    text: msg.content ?? msg.text ?? '',
    created: msg.created_at || new Date().toISOString(),
  };
}

/**
 * One shared cloud conversation.
 * No login/user_id is required for the current single-owner app.
 * Supabase is the source of truth; localStorage is only a cache/fallback.
 */
export function useChatHistory() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);

  const saveLocal = useCallback((next) => writeLocalMessages(next), []);

  const loadMessages = useCallback(async () => {
    const local = readLocalMessages();
    setMessages(local);
    setLoading(true);
    setError(null);

    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('chat_messages')
        .select('id, role, content, created_at')
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      const cloud = (data ?? []).map(normalizeMessage);

      if (cloud.length > 0) {
        setMessages(cloud);
        saveLocal(cloud);
      } else if (local.length > 0) {
        // One-time migration of old local history into the shared cloud.
        const rows = local.map((msg) => ({
          role: msg.role,
          content: msg.text,
          created_at: msg.created,
        }));

        const { data: migrated, error: migrateError } = await supabase
          .from('chat_messages')
          .insert(rows)
          .select('id, role, content, created_at');

        if (migrateError) throw migrateError;

        const migratedMessages = (migrated ?? []).map(normalizeMessage);
        setMessages(migratedMessages);
        saveLocal(migratedMessages);
      } else {
        setMessages([]);
      }
    } catch (err) {
      console.warn('Supabase chat history unavailable:', err);
      setError(err?.message || 'Unable to load cloud chat history.');
      setMessages(local);
    } finally {
      setLoading(false);
    }
  }, [saveLocal]);

  useEffect(() => {
    loadMessages();

    if (!supabase) return undefined;

    const channel = supabase
      .channel('pc-trader-shared-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const incoming = normalizeMessage(payload.new);

          setMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(incoming.id))) return prev;

            const next = [...prev, incoming].sort(
              (a, b) => new Date(a.created) - new Date(b.created)
            );
            saveLocal(next);
            return next;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chat_messages' },
        (payload) => {
          setMessages((prev) => {
            const next = prev.filter(
              (m) => String(m.id) !== String(payload.old.id)
            );
            saveLocal(next);
            return next;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Supabase Realtime channel error.');
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [loadMessages, saveLocal]);

  const addMessage = useCallback(async (role, text) => {
    const createdAt = new Date().toISOString();

    const optimistic = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role,
      text,
      created: createdAt,
    };

    setMessages((prev) => {
      const next = [...prev, optimistic];
      saveLocal(next);
      return next;
    });

    if (!supabase) return optimistic;

    try {
      const { data, error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          role,
          content: text,
          created_at: createdAt,
        })
        .select('id, role, content, created_at')
        .single();

      if (insertError) throw insertError;

      const saved = normalizeMessage(data);

      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimistic.id);

        if (withoutOptimistic.some((m) => String(m.id) === String(saved.id))) {
          saveLocal(withoutOptimistic);
          return withoutOptimistic;
        }

        const next = [...withoutOptimistic, saved].sort(
          (a, b) => new Date(a.created) - new Date(b.created)
        );
        saveLocal(next);
        return next;
      });

      return saved;
    } catch (err) {
      console.warn('Supabase chat save unavailable:', err);
      setError(err?.message || 'Unable to save cloud chat history.');
      return optimistic;
    }
  }, [saveLocal]);

  const formattedHistory = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }));

  return { messages, formattedHistory, loading, error, addMessage, reload: loadMessages };
}
