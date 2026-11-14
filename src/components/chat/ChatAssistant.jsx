import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChatHistory } from '../../data/chatHistory.js';
import { toolsConfig, SYSTEM_INSTRUCTION } from './config.js';
import { sendWithRetry, isRateLimitError } from './utils.js';
import { executeChatTool } from './executeChatTool.js';
import { ChatboxView } from './ChatboxView.jsx';

/**
 * AIAgentChatbox — floating AI agent with:
 * - Single-thread persistent memory via PocketBase
 * - Gemini Flash with function calling that directly controls the app
 * - Image vision input for automated data entry (with the photo actually saved)
 * - Mobile-first responsive design
 */
export function ChatAssistant({
  state,
  dispatch,
  setTab,
  setFormData,
  toast,
  open,
  setOpen,
}) {
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  // Optimistic local echo so the user's own message + a "thinking" indicator show up
  // instantly, instead of the chat looking frozen while the network round-trip happens.
  const [pendingMessages, setPendingMessages] = useState([]);

  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatSessionRef = useRef(null); // Native SDK Chat Session
  const geminiInitializedRef = useRef(false); // ensures the session above is created exactly once per page load
  const stateRef = useRef(state); // always-fresh state for tool execution (avoids stale closures)
  // The image attached to the CURRENT turn, so add_item_to_inventory can pick it up
  // even though tool execution happens inside an async loop, decoupled from render timing.
  const pendingImageRef = useRef(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  const { messages, formattedHistory, loading: historyLoading, error: historyError, addMessage } = useChatHistory();

  /* ───────────────────────────────────────────
     TOOL DEFINITIONS
     Every tool here maps directly onto a real reducer action via dispatch — nothing
     is a "pretend" action. Lookup tools (find_sales) exist so the model never has to
     guess an internal ID; it must search first, then act on the exact ID it found.
  ─────────────────────────────────────────── */
  /* ───────────────────────────────────────────
     INITIALIZE GEMINI — also reused as a repair function (see handleSend's catch block):
     if a turn ever fails mid function-call, the session can be left in a stuck state with
     a dangling, never-answered function call in its history. Rebuilding it from whatever's
     already persisted is how we recover, instead of every message failing until refresh.
  ─────────────────────────────────────────── */
  const initGemini = useCallback(async (historyOverride) => {
    try {
      const apiKey = import.meta.env?.VITE_GEMINI_KEY || import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.GEMINI_API_KEY || process?.env?.VITE_GEMINI_KEY || process?.env?.GEMINI_API_KEY;
      if (!apiKey) {
        console.error('Gemini API key not set. Add VITE_GEMINI_KEY to your local environment.');
        setAiReady(false);
        return false;
      }

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const sdkHistory = (historyOverride || formattedHistory || []).slice(-16).map((item) => ({
        role: item.role === 'user' ? 'user' : 'model',
        parts: item.parts || [{ text: item.text || '' }],
      }));

      chatSessionRef.current = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: sdkHistory,
        config: {
          temperature: 0.7,
          tools: toolsConfig,
          systemInstruction: SYSTEM_INSTRUCTION,
          ...(webSearchEnabled ? { enterpriseWebSearch: true } : {}),
        },
      });

      setAiReady(true);
      return true;
    } catch (err) {
      console.error('Failed to initialize Gemini:', err);
      setAiReady(false);
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formattedHistory, webSearchEnabled]);

  const handleToggleWebSearch = useCallback(() => {
    setWebSearchEnabled((prev) => !prev);
    setAiReady(false);
    chatSessionRef.current = null;
    geminiInitializedRef.current = false;
  }, []);

  useEffect(() => {
    // Guards this from running more than once on its own — formattedHistory changes every
    // time a message is saved, but the chat session itself must stay the SAME object for the
    // life of the tab. Recreating it mid-conversation was the original bug: it would swap out
    // chatSessionRef.current while a function-call response was still in flight, leaving
    // that response talking to a brand-new session that never asked for it. The ref guard
    // below is what makes this run exactly once at startup; initGemini changing reference
    // afterward (because formattedHistory changed) does NOT cause a re-run.
    if (geminiInitializedRef.current || historyLoading) return;
    geminiInitializedRef.current = true;
    initGemini();
  }, [historyLoading, initGemini]);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pendingMessages]);

  /* ───────────────────────────────────────────
     UPLOAD IMAGE TO POCKETBASE (via the same /photo endpoint the Buy form uses)
     Returns {photoUrl, photoRecordId} or null on failure — failure is non-fatal,
     the item still gets added, just without a photo attached.
  ─────────────────────────────────────────── */
  const uploadImageToPocketBase = useCallback(async (dataUrl) => {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const form = new FormData();
      form.append('photo', blob, 'chat-upload.jpg');
      const uploadRes = await fetch('/photo', { method: 'POST', body: form });
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
      const { url, recordId } = await uploadRes.json();
      return { photoUrl: url, photoRecordId: recordId };
    } catch (err) {
      console.error('Photo upload failed:', err);
      return null;
    }
  }, []);

  /* ───────────────────────────────────────────
     EXECUTE TOOL CALLS
  ─────────────────────────────────────────── */
  const executeTool = useCallback(
    (toolName, toolInput) => executeChatTool(toolName, toolInput, {
      liveState: stateRef.current, dispatch, setTab, setFormData, toast, pendingImageRef, uploadImageToPocketBase, messages,
    }),
    [setTab, setFormData, dispatch, toast, uploadImageToPocketBase, messages]
  );

  /* ───────────────────────────────────────────
     IMAGE UPLOAD (for vision input)
  ─────────────────────────────────────────── */
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result);
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  /* ───────────────────────────────────────────
     SEND MESSAGE — optimistic UI first, then the real round trip
  ─────────────────────────────────────────── */
  const handleSend = useCallback(async () => {
    if (!input.trim() && !selectedImage) return;
    if (!chatSessionRef.current || !aiReady) {
      toast?.('AI agent not ready yet', 'error');
      return;
    }

    // Capture this turn's values, then clear the UI IMMEDIATELY — this is what fixes
    // the input "staying" after send: we don't wait on any network round trip to clear it.
    const turnInput = input.trim();
    const turnImage = selectedImage;
    setInput('');
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    const userText = turnImage ? (turnInput ? `📷 ${turnInput}` : '📷 [Photo attached]') : turnInput;
    setPendingMessages([{ role: 'user', text: userText, _pending: true }]);
    pendingImageRef.current = turnImage;

    try {
      setSending(true);
      await addMessage('user', userText);

      const userParts = [];
      if (turnInput) userParts.push({ text: turnInput });
      if (turnImage) {
        const base64Data = turnImage.split(',')[1];
        userParts.push({ inlineData: { mimeType: 'image/jpeg', data: base64Data } });
      }

      let response;
      try {
        response = await sendWithRetry(() => chatSessionRef.current.sendMessage({ message: userParts }));
      } catch (err) {
        console.error('Gemini rejected the initial message:', err);
        throw err;
      }

      let iterations = 0;
      const maxIterations = 5;
      while (iterations < maxIterations) {
        iterations++;
        const functionCalls = response.functionCalls || [];
        if (!functionCalls.length) break;

        for (const call of functionCalls) {
          const { name, args } = call;
          const result = await executeTool(name, args);
          try {
            response = await sendWithRetry(() => chatSessionRef.current.sendMessage({
              message: [{ functionResponse: { name, response: { result } } }],
            }));
          } catch (err) {
            console.error(`Gemini rejected the function response for "${name}":`, err);
            throw err;
          }
        }
      }

      const finalText = response.text || '';
      if (finalText) {
        await addMessage('model', finalText);
        const recentHistory = [
          ...(formattedHistory || []),
          { role: 'user', parts: [{ text: userText }] },
          { role: 'model', parts: [{ text: finalText }] },
        ].slice(-16);
        chatSessionRef.current = null;
        await initGemini(recentHistory);
      }
    } catch (err) {
      console.error('Error during agent interaction loop:', err);
      if (isRateLimitError(err)) {
        toast?.("Gemini's request quota is full right now. Wait for it to reset, then try again.", 'error');
      } else {
        toast?.('Something went wrong talking to the assistant. Resetting — please try again.', 'error');
      }
      // A failed turn can leave the session with a dangling function call it never got an
      // answer to recorded for — every message after that would fail the same way. Rebuild
      // it fresh from whatever's already persisted so the NEXT message isn't stuck repeating
      // this same failure until the page is refreshed.
      chatSessionRef.current = null;
      setAiReady(false);
      await initGemini();
    } finally {
      setSending(false);
      setPendingMessages([]);
      pendingImageRef.current = null;
    }
  }, [input, selectedImage, aiReady, addMessage, executeTool, toast, initGemini]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !sending) {
      e.preventDefault();
      handleSend();
    }
  };

  if (historyError) {
    return (
      <div style={{ position: 'fixed', bottom: 'calc(78px + env(safe-area-inset-bottom))', right: 20, zIndex: 5000 }}>
        <div style={{ background: '#ef4444', color: '#fff', padding: 12, borderRadius: 8, fontSize: 12, maxWidth: 280 }}>
          Chat error: {historyError}
        </div>
      </div>
    );
  }

  return <ChatboxView {...{ open, setOpen, input, setInput, selectedImage, setSelectedImage, imagePreview, setImagePreview, sending, setSending, aiReady, setAiReady, webSearchEnabled, setWebSearchEnabled, pendingMessages, setPendingMessages, chatRef, messagesEndRef, fileInputRef, chatSessionRef, geminiInitializedRef, stateRef, pendingImageRef, messages, formattedHistory, historyLoading, historyError, addMessage, toolsConfig, SYSTEM_INSTRUCTION, initGemini, handleToggleWebSearch, uploadImageToPocketBase, executeTool, handleImageSelect, handleSend, handleKeyPress }}/>;

}
