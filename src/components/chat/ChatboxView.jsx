import React from "react";

import { formatMessageText } from "./formatMessageText.jsx";

export function ChatboxView(props) {
  const { open, setOpen, input, setInput, selectedImage, setSelectedImage, imagePreview, setImagePreview, sending, setSending, aiReady, setAiReady, webSearchEnabled, setWebSearchEnabled, pendingMessages, setPendingMessages, chatRef, messagesEndRef, fileInputRef, chatSessionRef, geminiInitializedRef, stateRef, pendingImageRef, messages, formattedHistory, historyLoading, historyError, addMessage, toolsConfig, SYSTEM_INSTRUCTION, initGemini, handleToggleWebSearch, uploadImageToPocketBase, executeTool, handleImageSelect, handleSend, handleKeyPress } = props;
  const displayMessages = [...messages, ...pendingMessages];

  return (
    <>
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 5000 }} onClick={() => setOpen(false)} />
      )}

      {open && (
        <div
          style={{
            position: 'fixed', bottom: 0, right: 0, width: 'min(100%, 420px)', height: '70vh', maxHeight: '80vh',
            background: '#18181b', borderRadius: '18px 18px 0 0', border: '1px solid #27272a',
            display: 'flex', flexDirection: 'column', animation: 'slideUp 0.25s ease', zIndex: 5001,
            boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #27272a', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>🤖 AI Assistant</div>
            <button
              type="button"
              onClick={handleToggleWebSearch}
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
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>

          {/* Messages */}
          <div ref={chatRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '16px', background: '#09090b' }}>
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
                      color: '#fff', padding: '10px 12px', borderRadius: 12, fontSize: 13,
                      lineHeight: 1.45, wordBreak: 'break-word', opacity: msg._pending ? 0.6 : 1,
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
          <div style={{ display: 'flex', gap: 8, padding: '12px', borderTop: '1px solid #27272a', flexShrink: 0, background: '#18181b', borderRadius: '0 0 18px 0' }}>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} style={{ display: 'none' }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: sending ? 'not-allowed' : 'pointer', fontSize: 16, opacity: sending ? 0.5 : 1 }}
              title="Attach image"
            >📷</button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sending || !aiReady}
              placeholder={aiReady ? 'Ask me anything...' : 'Loading...'}
              style={{
                flex: 1, background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6, color: '#fff',
                padding: '8px 10px', fontSize: 13, resize: 'none', maxHeight: 80, fontFamily: 'inherit',
                outline: 'none', opacity: aiReady ? 1 : 0.5,
              }}
              rows={2}
            />
            <button
              onClick={handleSend}
              disabled={sending || !aiReady || (!input.trim() && !selectedImage)}
              style={{
                background: '#7c3aed', border: 'none', color: '#fff',
                cursor: sending || !aiReady || (!input.trim() && !selectedImage) ? 'not-allowed' : 'pointer',
                padding: '8px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                opacity: sending || !aiReady || (!input.trim() && !selectedImage) ? 0.5 : 1,
              }}
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
