import React from "react";

import { formatMessageText } from "./formatMessageText.jsx";

export function ChatboxView(props) {
  const { open, setOpen, input, setInput, selectedImage, setSelectedImage, imagePreview, setImagePreview, sending, setSending, aiReady, setAiReady, webSearchEnabled, setWebSearchEnabled, pendingMessages, setPendingMessages, chatRef, messagesEndRef, fileInputRef, chatSessionRef, geminiInitializedRef, stateRef, pendingImageRef, messages, formattedHistory, historyLoading, historyError, addMessage, toolsConfig, SYSTEM_INSTRUCTION, initGemini, handleToggleWebSearch, uploadImageToPocketBase, executeTool, handleImageSelect, handleSend, handleKeyPress } = props;
  const displayMessages = [...messages, ...pendingMessages];

  return (
    <>
      {open && (
        <div className="chat-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.28)', zIndex: 5000 }} onClick={() => setOpen(false)} />
      )}

      {open && (
        <div
          className="chat-panel"
          role="dialog"
          aria-modal="true"
          aria-label="AI Assistant"
          style={{
            position: 'fixed', bottom: 16, right: 16, width: 'min(460px, calc(100vw - 32px))', height: 'min(78dvh, 760px)', maxHeight: 'calc(100dvh - 32px)',
            background: '#18181b', borderRadius: '18px 18px 0 0', border: '1px solid #27272a',
            display: 'flex', flexDirection: 'column', animation: 'slideUp 0.25s ease', zIndex: 5001,
            boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #27272a', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>🤖 AI Assistant</div>
            <button
              type="button"
              onClick={handleToggleWebSearch}
              aria-pressed={webSearchEnabled}
              style={{
                background: webSearchEnabled ? '#22c55e' : '#27272a',
                border: '1px solid',
                borderColor: webSearchEnabled ? '#16a34a' : '#3f3f46',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 11,
                padding: '6px 10px',
                borderRadius: 999,
                width: 'max-content',
              }}
            >
              {webSearchEnabled ? 'Web search ON' : 'Web search OFF'}
            </button>
          </div>
            <button type="button" aria-label="Close AI Assistant" onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 18, minWidth: 44, minHeight: 44 }}>✕</button>
          </div>

          {/* Messages */}
          <div ref={chatRef} className="chat-messages" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '16px', background: '#09090b' }}>
            {historyLoading ? (
              <div style={{ color: '#71717a', textAlign: 'center', margin: 'auto' }}>Loading conversation...</div>
            ) : displayMessages.length === 0 ? (
              <div style={{ color: '#52525b', textAlign: 'center', margin: 'auto', fontSize: 12 }}>
                👋 Ask about your inventory, add items, manage sales, or navigate the app.
              </div>
            ) : (
              displayMessages.map((msg, i) => (
                <div key={msg.id || i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '85%',
                      background: msg.role === 'user' ? '#7c3aed' : '#27272a',
                      color: '#fff', padding: '11px 13px', borderRadius: 12, fontSize: 14,
                      lineHeight: 1.5, wordBreak: 'break-word', opacity: msg._pending ? 0.6 : 1,
                    }}
                  >
                    {formatMessageText(msg.text)}
                  </div>
                </div>
              ))
            )}
            {sending && pendingMessages.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#27272a', color: '#71717a', padding: '10px 12px', borderRadius: 12, fontSize: 13 }}>
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image Preview */}
          {imagePreview && (
            <div style={{ padding: '8px 12px', borderTop: '1px solid #27272a', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <img src={imagePreview} alt="preview" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />
              <button
                onClick={() => { setSelectedImage(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, marginTop: 8 }}
              >✕</button>
            </div>
          )}

          {/* Input */}
          <div className="chat-composer" style={{ display: 'flex', gap: 8, padding: '12px', borderTop: '1px solid #27272a', flexShrink: 0, background: '#18181b', borderRadius: '0 0 18px 0', alignItems: 'flex-end' }}>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} style={{ display: 'none' }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              aria-label="Attach image"
              style={{ background: 'none', border: 'none', color: '#c4b5fd', cursor: sending ? 'not-allowed' : 'pointer', fontSize: 18, opacity: sending ? 0.5 : 1, minWidth: 44, minHeight: 44, flexShrink: 0 }}
              title="Attach image"
            >📷</button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sending || !aiReady}
              aria-label="Message the AI assistant"
              placeholder={aiReady ? 'Ask me anything...' : 'Loading...'}
              style={{
                flex: 1, background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6, color: '#fff',
                padding: '10px 12px', fontSize: 14, resize: 'none', minHeight: 44, maxHeight: 112, fontFamily: 'inherit',
                outline: 'none', opacity: aiReady ? 1 : 0.5,
              }}
              rows={2}
            />
            <button
              onClick={handleSend}
              disabled={sending || !aiReady || (!input.trim() && !selectedImage)}
              aria-label={sending ? 'Sending message' : 'Send message'}
              style={{
                background: '#7c3aed', border: 'none', color: '#fff',
                cursor: sending || !aiReady || (!input.trim() && !selectedImage) ? 'not-allowed' : 'pointer',
                padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, minHeight: 44, minWidth: 64,
                opacity: sending || !aiReady || (!input.trim() && !selectedImage) ? 0.5 : 1,
              }}
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .chat-panel { overflow: hidden; }
        .chat-messages { overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
        .chat-composer textarea:focus { border-color: #a78bfa !important; box-shadow: 0 0 0 2px rgba(167,139,250,.28); }
        @media (min-width: 701px) {
          .chat-panel { border-radius: 18px !important; }
          .chat-messages { padding: 18px !important; }
          .chat-composer { padding: 14px !important; border-radius: 0 0 18px 18px !important; }
        }
        @media (max-width: 700px) {
          .chat-panel { inset: 0 !important; width: 100% !important; height: 100dvh !important; max-height: 100dvh !important; bottom: auto !important; right: auto !important; border-radius: 0 !important; box-sizing: border-box; padding-top: env(safe-area-inset-top); }
          .chat-header { padding: 10px 16px !important; }
          .chat-messages { padding: 16px !important; }
          .chat-composer { padding: 10px 12px calc(10px + env(safe-area-inset-bottom)) !important; border-radius: 0 !important; }
          .chat-backdrop { display: none; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
