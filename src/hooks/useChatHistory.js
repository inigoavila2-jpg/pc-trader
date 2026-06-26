import { useState, useEffect, useCallback } from 'react';

/**
 * useChatHistory — loads and manages the single-thread conversation from PocketBase.
 * This is the ONE source of truth for the AI agent's memory across sessions.
 */
export function useChatHistory(pbUrl) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load all messages on mount
  useEffect(() => {
    const loadMessages = async () => {
      try {
        const response = await fetch(
          `${pbUrl}/api/collections/chat_messages/records?sort=created`,
          {
            headers: { 'Content-Type': 'application/json' },
          }
        );
        if (!response.ok) throw new Error(`Failed to load chat: ${response.status}`);
        const data = await response.json();
        setMessages(data.items || []);
      } catch (err) {
        console.error('Error loading chat history:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadMessages();
  }, [pbUrl]);

  // Add message to local state AND PocketBase
  const addMessage = useCallback(
    async (role, text) => {
      try {
        const response = await fetch(
          `${pbUrl}/api/collections/chat_messages/records`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, text }),
          }
        );
        if (!response.ok) throw new Error(`Failed to save message: ${response.status}`);
        const newMsg = await response.json();
        setMessages((prev) => [...prev, newMsg]);
        return newMsg;
      } catch (err) {
        console.error('Error saving message:', err);
        throw err;
      }
    },
    [pbUrl]
  );

  // Format messages for Gemini's startChat() API
  const formattedHistory = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.text }],
  }));

  return { messages, formattedHistory, loading, error, addMessage };
}
