import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { useChatHistory } from '../hooks/useChatHistory';

/**
 * AIAgentChatbox — floating AI agent with:
 * - Single-thread persistent memory via PocketBase
 * - Gemini Flash with function calling
 * - Image vision input for automated data entry
 * - Mobile-first responsive design
 */
export function AIAgentChatbox({
  pbUrl,
  state,
  dispatch,
  setTab,
  setFormData,
  toast,
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const conversationRef = useRef(null);

  const { messages, formattedHistory, loading: historyLoading, error: historyError, addMessage } = useChatHistory(pbUrl);

  // Initialize Gemini on mount
  useEffect(() => {
    const initGemini = async () => {
      try {
        const apiKey = import.meta.env.VITE_GEMINI_KEY;
        if (!apiKey) {
          console.error('VITE_GEMINI_KEY not set');
          return;
        }
        const ai = new GoogleGenerativeAI({ apiKey });
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        // Start conversation with history
        conversationRef.current = model.startChat({
          history: formattedHistory,
          generationConfig: { temperature: 0.7 },
        });
        setAiReady(true);
      } catch (err) {
        console.error('Failed to initialize Gemini:', err);
      }
    };

    if (!historyLoading && formattedHistory.length >= 0) {
      initGemini();
    }
  }, [historyLoading, formattedHistory]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Tool definitions for Gemini function calling
  const tools = [
    {
      name: 'navigate_tabs',
      description: 'Change the active tab in the app (e.g., "Dashboard", "Buy", "Inventory", "Builds", "Sell", "History", "Settings")',
      inputSchema: {
        type: 'object',
        properties: {
          tabName: {
            type: 'string',
            description: 'The name of the tab to navigate to',
          },
        },
        required: ['tabName'],
      },
    },
    {
      name: 'pre_fill_buy_form',
      description: 'Populate the Buy form with item data (name, cost, category, domain, marketPrice)',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          cost: { type: 'number' },
          category: { type: 'string' },
          domain: { type: 'string', enum: ['pc', 'general'] },
          marketPrice: { type: 'number' },
        },
        required: ['name', 'cost'],
      },
    },
    {
      name: 'query_pocketbase_inventory',
      description: 'Get a fresh snapshot of the current available inventory as a JSON string',
      inputSchema: { type: 'object', properties: {} },
    },
  ];

  // Execute tool calls from Gemini
  const executeTool = useCallback(
    async (toolName, toolInput) => {
      try {
        switch (toolName) {
          case 'navigate_tabs': {
            const validTabs = ['Dashboard', 'Buy', 'Inventory', 'Builds', 'Sell', 'History', 'Settings'];
            const tab = validTabs.find(t => t.toLowerCase() === (toolInput.tabName || '').toLowerCase());
            if (tab) {
              setTab(tab);
              return `Navigated to ${tab} tab`;
            }
            return `Invalid tab: ${toolInput.tabName}`;
          }

          case 'pre_fill_buy_form': {
            const { name, cost, category, domain, marketPrice } = toolInput;
            if (setFormData) {
              setFormData('buy', {
                singleName: name || '',
                singleCost: String(cost || ''),
                singleMarket: String(marketPrice || cost || ''),
                singleCat: category || 'Other',
                singleDomain: domain || 'pc',
              });
              setTab('Buy');
              return `Pre-filled Buy form with: ${name} (₱${cost})`;
            }
            return 'Unable to pre-fill form';
          }

          case 'query_pocketbase_inventory': {
            const available = state.parts.filter(p => p.status === 'available');
            const summary = {
              total: available.length,
              byCategory: {},
              items: available.slice(0, 10).map(p => ({
                name: p.name,
                category: p.category,
                cost: p.allocatedCost,
                market: p.marketValue,
              })),
            };
            available.forEach(p => {
              summary.byCategory[p.category] = (summary.byCategory[p.category] || 0) + 1;
            });
            return JSON.stringify(summary);
          }

          default:
            return `Unknown tool: ${toolName}`;
        }
      } catch (err) {
        console.error(`Error executing tool ${toolName}:`, err);
        return `Error: ${err.message}`;
      }
    },
    [state, setTab, setFormData]
  );

  // Handle image upload
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

  // Send message to Gemini with function calling loop
  const handleSend = useCallback(async () => {
    if (!input.trim() && !selectedImage) return;
    if (!conversationRef.current || !aiReady) {
      toast('AI agent not ready yet', 'error');
      return;
    }

    try {
      setSending(true);

      // Save user message
      const userText = selectedImage
        ? `[Image attached] ${input}`
        : input;
      await addMessage('user', userText);

      // Build Gemini request
      const userMessage = {
        parts: [],
      };

      // Add text if provided
      if (input.trim()) {
        userMessage.parts.push({ text: input.trim() });
      }

      // Add image if provided
      if (selectedImage) {
        const base64Data = selectedImage.split(',')[1];
        userMessage.parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data,
          },
        });
      }

      // Function calling loop
      let response = await conversationRef.current.sendMessage([...userMessage.parts]);
      let iterations = 0;
      const maxIterations = 5;

      while (iterations < maxIterations) {
        iterations++;
        const content = response.response.content;
        
        // Check for function calls
        let hasFunctionCall = false;
        for (const part of content.parts || []) {
          if (part.functionCall) {
            hasFunctionCall = true;
            const { name, args } = part.functionCall;
            const result = await executeTool(name, args);
            
            // Send tool result back to model
            response = await conversationRef.current.sendMessage([
              {
                functionResponse: {
                  name,
                  response: { result },
                },
              },
            ]);
          }
        }

        // If no function calls or reached max iterations, break
        if (!hasFunctionCall) break;
      }

      // Extract final text response
      let finalText = '';
      for (const part of response.response.content.parts || []) {
        if (part.text) {
          finalText += part.text;
        }
      }

      // Save AI response
      if (finalText) {
        await addMessage('model', finalText);
      }

      // Clear input
      setInput('');
      setSelectedImage(null);
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Toast success
      if (finalText) {
        toast('AI response received', 'success');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      toast(`Error: ${err.message}`, 'error');
    } finally {
      setSending(false);
    }
  }, [input, selectedImage, aiReady, addMessage, executeTool, toast]);

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !sending) {
      e.preventDefault();
      handleSend();
    }
  };

  if (historyError) {
    return (
      <div style={{position:'fixed',bottom:20,right:20,zIndex:5000}}>
        <div style={{background:'#ef4444',color:'#fff',padding:12,borderRadius:8,fontSize:12}}>
          Chat error: {historyError}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Floating Chat Bubble */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#7c3aed',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
          boxShadow: '0 8px 24px rgba(124,58,237,0.4)',
          zIndex: 4999,
          transition: 'transform 0.2s, box-shadow 0.2s',
          transform: open ? 'scale(1.1)' : 'scale(1)',
        }}
        title="AI Assistant"
      >
        🤖
      </button>

      {/* Chat Drawer Overlay */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 5000,
          }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* Chat Drawer */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            right: 0,
            width: 'min(100%, 420px)',
            height: '70vh',
            maxHeight: '80vh',
            background: '#18181b',
            borderRadius: '18px 18px 0 0',
            border: '1px solid #27272a',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideUp 0.25s ease',
            zIndex: 5001,
            boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              borderBottom: '1px solid #27272a',
              flexShrink: 0,
            }}
          >
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
              🤖 AI Assistant
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#71717a',
                cursor: 'pointer',
                fontSize: 18,
              }}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div
            ref={chatRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              padding: '16px',
              background: '#09090b',
            }}
          >
            {historyLoading ? (
              <div style={{ color: '#71717a', textAlign: 'center', margin: 'auto' }}>
                Loading conversation...
              </div>
            ) : messages.length === 0 ? (
              <div style={{ color: '#52525b', textAlign: 'center', margin: 'auto', fontSize: 12 }}>
                👋 Start a conversation with your AI assistant. Ask questions about your inventory, get help buying items, or control the app.
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div
                    style={{
                      maxWidth: '85%',
                      background:
                        msg.role === 'user'
                          ? '#7c3aed'
                          : '#27272a',
                      color: '#fff',
                      padding: '10px 12px',
                      borderRadius: 12,
                      fontSize: 13,
                      lineHeight: 1.4,
                      wordBreak: 'break-word',
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image Preview */}
          {imagePreview && (
            <div
              style={{
                padding: '8px 12px',
                borderTop: '1px solid #27272a',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <img
                src={imagePreview}
                alt="preview"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  objectFit: 'cover',
                }}
              />
              <button
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: 14,
                  marginTop: 8,
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Input */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '12px',
              borderTop: '1px solid #27272a',
              flexShrink: 0,
              background: '#18181b',
              borderRadius: '0 0 18px 0',
            }}
          >
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleImageSelect}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              style={{
                background: 'none',
                border: 'none',
                color: '#7c3aed',
                cursor: sending ? 'not-allowed' : 'pointer',
                fontSize: 16,
                opacity: sending ? 0.5 : 1,
              }}
              title="Attach image"
            >
              📷
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sending || !aiReady}
              placeholder={aiReady ? 'Ask me anything...' : 'Loading...'}
              style={{
                flex: 1,
                background: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: 6,
                color: '#fff',
                padding: '8px 10px',
                fontSize: 13,
                resize: 'none',
                maxHeight: 80,
                fontFamily: 'inherit',
                outline: 'none',
                opacity: aiReady ? 1 : 0.5,
              }}
              rows={2}
            />
            <button
              onClick={handleSend}
              disabled={sending || !aiReady || (!input.trim() && !selectedImage)}
              style={{
                background: '#7c3aed',
                border: 'none',
                color: '#fff',
                cursor:
                  sending || !aiReady || (!input.trim() && !selectedImage)
                    ? 'not-allowed'
                    : 'pointer',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                opacity:
                  sending || !aiReady || (!input.trim() && !selectedImage)
                    ? 0.5
                    : 1,
              }}
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
