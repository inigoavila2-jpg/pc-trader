import React from "react";
import { Camera, Globe2, Loader2, Sparkles, X } from "lucide-react";

import { formatMessageText } from "./formatMessageText.jsx";
import { useTheme } from "../theme.js";

export function ChatboxView(props) {
  const t = useTheme();
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
            background: t.bgElevated, borderRadius: '18px 18px 0 0', border: `1px solid ${t.border}`,
            display: 'flex', flexDirection: 'column', animation: 'slideUp 0.25s ease', zIndex: 5001,
            boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 13, display: 'grid', placeItems: 'center', background: t.accentSoft, color: t.accent, border: `1px solid ${t.accentSoftBorder}` }}><Sparkles size={19}/></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ color: t.text, fontWeight: 700, fontSize: 14 }}>AI Assistant</div>
                <div style={{ color: t.textMuted, fontSize: 11 }}>Your PC trading copilot</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              onClick={handleToggleWebSearch}
              aria-pressed={webSearchEnabled}
              title="Toggle web search"
              style={{
                background: webSearchEnabled ? t.positiveSoft : t.surfaceSunken,
                border: `1px solid ${webSearchEnabled ? t.positiveSoftBorder : t.border}`,
                color: webSearchEnabled ? t.positive : t.textMuted,
                cursor: 'pointer',
                fontSize: 11, fontWeight: 600,
                padding: '7px 10px', borderRadius: 999, minHeight: 36,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              <Globe2 size={13}/>{webSearchEnabled ? 'Web on' : 'Web off'}
            </button>
            <button type="button" aria-label="Close AI Assistant" onClick={() => setOpen(false)} className="chat-icon-button bl-focusable" style={{ background: t.surfaceSunken, border: `1px solid ${t.border}`, color: t.textMuted, cursor: 'pointer', minWidth: 40, minHeight: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><X size={18}/></button>
            </div>
          </div>

          {/* Messages */}
          <div ref={chatRef} className="chat-messages" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '16px', background: t.bg }}>
            {historyLoading ? (
              <div role="status" style={{ color: t.textMuted, textAlign: 'center', margin: 'auto', display: 'flex', alignItems: 'center', gap: 9 }}><Loader2 size={17} className="bl-spin"/>Loading conversation…</div>
            ) : displayMessages.length === 0 ? (
              <div style={{ color: t.textMuted, textAlign: 'center', margin: 'auto', maxWidth: 340, padding: 18 }}>
                <div aria-hidden="true" style={{ width: 54, height: 54, borderRadius: 18, display: 'grid', placeItems: 'center', margin: '0 auto 14px', background: t.accentSoft, color: t.accent }}><Sparkles size={24}/></div>
                <div style={{ color: t.text, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>What can I help with?</div>
                <div style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 16 }}>Ask about stock, sales, PC builds, or your business numbers.</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
                  {['Recent transactions', 'What should I sell?', 'Check my stock'].map((prompt) => <button className="chat-suggestion" key={prompt} type="button" onClick={() => setInput(prompt)} style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.text, borderRadius: 999, padding: '9px 12px', minHeight: 40, fontSize: 12, cursor: 'pointer' }}>{prompt}</button>)}
                </div>
              </div>
            ) : (
              displayMessages.map((msg, i) => (
                <div key={msg.id || i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div
                    style={{
                      maxWidth: '85%',
                      background: msg.role === 'user' ? t.accentStrong : t.surface,
                      color: msg.role === 'user' ? t.accentContrast : t.text, border: `1px solid ${msg.role === 'user' ? t.accentSoftBorder : t.border}`, padding: '11px 14px', borderRadius: msg.role === 'user' ? '16px 16px 5px 16px' : '16px 16px 16px 5px', fontSize: 14,
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
                <div role="status" style={{ background: t.surface, color: t.textMuted, border: `1px solid ${t.border}`, padding: '10px 13px', borderRadius: 14, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Loader2 size={15} className="bl-spin" color={t.accent}/> Thinking…
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image Preview */}
          {imagePreview && (
            <div style={{ padding: '8px 12px', borderTop: `1px solid ${t.border}`, display: 'flex', gap: 8, alignItems: 'flex-start', background: t.bgElevated }}>
              <img src={imagePreview} alt="preview" style={{ width: 48, height: 48, borderRadius: 6, objectFit: 'cover' }} />
              <button
                onClick={() => { setSelectedImage(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                aria-label="Remove attached image"
                style={{ background: 'none', border: 'none', color: t.negative, cursor: 'pointer', fontSize: 14, marginTop: 8, minWidth: 40, minHeight: 40 }}
              ><X size={17}/></button>
            </div>
          )}

          {/* Input */}
          <div className="chat-composer" style={{ display: 'flex', gap: 9, padding: '12px', borderTop: `1px solid ${t.border}`, flexShrink: 0, background: t.bgElevated, borderRadius: '0 0 18px 0', alignItems: 'flex-end' }}>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} style={{ display: 'none' }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              aria-label="Attach image"
              style={{ background: t.surface, border: `1px solid ${t.border}`, color: t.textMuted, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.5 : 1, minWidth: 44, minHeight: 44, flexShrink: 0, borderRadius: 12, display: 'grid', placeItems: 'center' }}
              title="Attach image"
            ><Camera size={18}/></button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sending || !aiReady}
              aria-label="Message the AI assistant"
              placeholder={aiReady ? 'Ask me anything...' : 'Loading...'}
              style={{
                flex: 1, background: t.surfaceSunken, border: `1px solid ${t.border}`, borderRadius: 12, color: t.text,
                padding: '11px 13px', fontSize: 14, resize: 'none', minHeight: 44, maxHeight: 112, fontFamily: 'inherit', lineHeight: 1.45,
                outline: 'none', opacity: aiReady ? 1 : 0.5,
              }}
              rows={2}
            />
            <button
              onClick={handleSend}
              disabled={sending || !aiReady || (!input.trim() && !selectedImage)}
              aria-label={sending ? 'Sending message' : 'Send message'}
              style={{
                background: t.accentStrong, border: 'none', color: t.accentContrast,
                cursor: sending || !aiReady || (!input.trim() && !selectedImage) ? 'not-allowed' : 'pointer',
                padding: '10px 14px', borderRadius: 12, fontSize: 13, fontWeight: 700, minHeight: 44, minWidth: 68,
                opacity: sending || !aiReady || (!input.trim() && !selectedImage) ? 0.5 : 1,
              }}
            >
              {sending ? <Loader2 size={17} className="bl-spin"/> : <>Send <span aria-hidden="true">↗</span></>}
            </button>
          </div>
        </div>
      )}

      <style>{`
        .chat-panel { overflow: hidden; }
        .chat-messages { overscroll-behavior-y: contain; -webkit-overflow-scrolling: touch; touch-action: pan-y; }
        .chat-composer textarea:focus { border-color: #a78bfa !important; box-shadow: 0 0 0 2px rgba(167,139,250,.28); }
        .chat-suggestion { transition: background .15s ease, border-color .15s ease, transform .15s ease; }
        .chat-suggestion:hover { background: ${t.surfaceHover} !important; border-color: ${t.borderStrong} !important; transform: translateY(-1px); }
        .chat-icon-button:hover { color: ${t.text} !important; background: ${t.surfaceHover} !important; }
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
