import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useChatHistory } from '../hooks/useChatHistory';

/* ─────────────────────────────────────────────────────────────
   Tiny local helpers — App.jsx has its own uid/today/fmt but doesn't
   export them, so the chatbox needs its own copies to build sale/part
   objects that match the reducer's expected shape exactly.
───────────────────────────────────────────────────────────── */
const cbUid = () => `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const cbToday = () => new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
const cbFmt = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 })}`;

/**
 * Renders message text as clean conversational text instead of dumping raw markdown.
 * Handles **bold**, leading "* " / "- " bullets, and ``` code fences without needing
 * a markdown library — just enough to stop asterisks/hashes showing up literally.
 */
function formatMessageText(text) {
  if (!text) return null;
  const lines = String(text).split('\n');
  const nodes = [];
  let inCodeBlock = false;
  let codeBuffer = [];

  const renderInline = (line) => {
    const parts = line.split(/\*\*(.+?)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : part
    );
  };

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();

    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        nodes.push(
          <pre key={`code-${idx}`} style={{
            background: '#09090b', border: '1px solid #27272a', borderRadius: 6,
            padding: '8px 10px', fontSize: 12, overflowX: 'auto', margin: '4px 0',
            fontFamily: 'monospace', whiteSpace: 'pre-wrap',
          }}>{codeBuffer.join('\n')}</pre>
        );
        codeBuffer = [];
      }
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) {
      codeBuffer.push(rawLine);
      return;
    }

    if (!trimmed) {
      nodes.push(<div key={`sp-${idx}`} style={{ height: 6 }} />);
      return;
    }

    const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      nodes.push(
        <div key={idx} style={{ display: 'flex', gap: 6, paddingLeft: 2 }}>
          <span style={{ opacity: 0.6 }}>•</span>
          <span>{renderInline(bulletMatch[1])}</span>
        </div>
      );
      return;
    }

    const headerMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (headerMatch) {
      nodes.push(<div key={idx} style={{ fontWeight: 700, marginTop: 2 }}>{renderInline(headerMatch[1])}</div>);
      return;
    }

    nodes.push(<div key={idx}>{renderInline(trimmed)}</div>);
  });

  return nodes;
}

/**
 * AIAgentChatbox — floating AI agent with:
 * - Single-thread persistent memory via PocketBase
 * - Gemini Flash with function calling that directly controls the app
 * - Image vision input for automated data entry (with the photo actually saved)
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
  // Optimistic local echo so the user's own message + a "thinking" indicator show up
  // instantly, instead of the chat looking frozen while the network round-trip happens.
  const [pendingMessages, setPendingMessages] = useState([]);

  const chatRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatSessionRef = useRef(null); // Native SDK Chat Session
  const stateRef = useRef(state); // always-fresh state for tool execution (avoids stale closures)
  // The image attached to the CURRENT turn, so add_item_to_inventory can pick it up
  // even though tool execution happens inside an async loop, decoupled from render timing.
  const pendingImageRef = useRef(null);

  useEffect(() => { stateRef.current = state; }, [state]);

  const { messages, formattedHistory, loading: historyLoading, error: historyError, addMessage } = useChatHistory(pbUrl);

  /* ───────────────────────────────────────────
     TOOL DEFINITIONS
     Every tool here maps directly onto a real reducer action via dispatch — nothing
     is a "pretend" action. Lookup tools (find_sales) exist so the model never has to
     guess an internal ID; it must search first, then act on the exact ID it found.
  ─────────────────────────────────────────── */
  const toolsConfig = [
    {
      functionDeclarations: [
        {
          name: 'navigate_tabs',
          description: 'Change the active tab in the app. Valid tabs: Dashboard, Buy, Inventory, Builds, Sell, History, Settings.',
          parameters: {
            type: 'object',
            properties: { tabName: { type: 'string' } },
            required: ['tabName'],
          },
        },
        {
          name: 'pre_fill_buy_form',
          description: 'Populate the Buy form fields WITHOUT adding the item yet, so the user can review/edit before submitting themselves. Only use this if the user explicitly asks to "fill in the form" or "pre-fill" rather than asking you to add the item directly.',
          parameters: {
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
          name: 'add_item_to_inventory',
          description: 'Directly add a new item to inventory as available stock — this actually saves it, it does not just fill a form. Use this whenever the user says things like "add it", "add this to my inventory", "I bought this for X". If the user attached a photo in this turn, it is automatically attached to the new inventory item — you do not need to handle the image yourself, just describe what you saw in the image as part of the name/category. If you do not know the cost yet, ask the user before calling this.',
          parameters: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Descriptive name, e.g. "AORUS GeForce RTX 5090 STEALTH ICE 32G"' },
              cost: { type: 'number', description: 'What the user paid for it' },
              marketPrice: { type: 'number', description: 'Current resale/market value. Defaults to cost if not given.' },
              category: { type: 'string', description: 'GPU, CPU, Motherboard, CPU+MB, RAM, PSU, Storage, Cooler, Case, Monitor, or Other' },
              domain: { type: 'string', enum: ['pc', 'general'], description: '"pc" for PC parts, "general" for non-PC assets' },
              notes: { type: 'string', description: 'Any condition notes, extras, or details worth remembering' },
            },
            required: ['name', 'cost'],
          },
        },
        {
          name: 'query_pocketbase_inventory',
          description: 'Get a fresh snapshot of current available inventory as a JSON string — use this to answer stock questions like "how many GPUs do I have".',
          parameters: { type: 'object', properties: {} },
        },
        {
          name: 'find_sales',
          description: 'Search past transactions by buyer name or item name (case-insensitive, partial match OK). Returns a JSON list with the exact saleId for each match. ALWAYS call this before delete_transaction — never guess a saleId.',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string', description: 'Buyer name or item name to search for' } },
            required: ['query'],
          },
        },
        {
          name: 'delete_transaction',
          description: 'Delete a sale record, found via find_sales first. Set returnToInventory to true if the item should go back into available stock (most "undo this sale" requests want this).',
          parameters: {
            type: 'object',
            properties: {
              saleId: { type: 'string', description: 'Exact saleId from a previous find_sales call' },
              returnToInventory: { type: 'boolean' },
            },
            required: ['saleId'],
          },
        },
        {
          name: 'sell_item',
          description: 'Mark an available item or active build as sold, recording the sale. Finds the item by name (partial match).',
          parameters: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              salePrice: { type: 'number' },
              buyerName: { type: 'string' },
            },
            required: ['itemName', 'salePrice'],
          },
        },
        {
          name: 'mark_item_defective',
          description: 'Mark an available or in-build item as defective/write-off, recording the capital loss. Finds the item by name (partial match).',
          parameters: {
            type: 'object',
            properties: {
              itemName: { type: 'string' },
              reason: { type: 'string' },
            },
            required: ['itemName'],
          },
        },
      ],
    },
  ];

  const SYSTEM_INSTRUCTION = `You are an expert PC hardware consultant and a helpful inventory assistant for a PC hardware reselling business. You provide sharp technical feedback, compatibility checks, and performance opinions on custom PC builds, prioritizing hardware longevity and thermal efficiency.

Always reply in clean, natural, conversational sentences. Do not use markdown formatting — no asterisks for bold, no "#" headers, no bullet-point characters. Just write the way you'd talk to someone over text. Assume all prices and transactions are in Philippine Pesos (PHP/₱) unless stated otherwise.

CRITICAL RULE FOR INVENTORY VS. EXPENSES:
If the user says they "spent", "paid", bought consumables (like gas, food, or tools), or paid a bill, you must treat this as an EXPENSE and use your tool/action to log an expense. DO NOT add these items to inventory. ONLY use add_item_to_inventory for physical hardware, parts, or stock explicitly intended to be resold as part of the business.

When looking up, selling, or modifying an item, you must use the exact name, shorthand, or spelling the user provides in your tool arguments (for example, if the user says "iphone 13pm 256", use "iphone 13pm 256" exactly in the tool call; do not automatically expand it to "iPhone 13 Pro Max 256GB").

Never tell the user an action is complete, a transaction is deleted, or an item is returned until the corresponding tool has actually executed successfully. If a tool returns an error or cannot find an item, tell the user exactly what went wrong instead of making up a success message.

When the user wants to add a valid item to inventory, call add_item_to_inventory directly. If you don't know the cost yet, ask for it before adding. Only use pre_fill_buy_form if the user specifically says they want to fill in or review the form first.

When the user uploads a photo of hardware, read any visible labels, model names, and specs from the image and use them to write a good "name" for add_item_to_inventory. Combine that with whatever numbers (cost, market price) the user gives you.

When the user wants to sell an item, ensure you know the exact item name, the sale price, and the buyer. If any of this information is missing, ask the user for it before calling the sales tool.

When the user wants to delete, undo, or return a sale, first call find_sales to locate the exact transaction. If you get more than one plausible match, ask the user which one they mean instead of guessing. Only after you have verified the exact saleId from the tool output should you call delete_transaction.

Keep responses short and to the point.`;

  /* ───────────────────────────────────────────
     INITIALIZE GEMINI
  ─────────────────────────────────────────── */
  useEffect(() => {
    const initGemini = async () => {
      try {
        const apiKey = import.meta.env?.VITE_GEMINI_KEY || process?.env?.VITE_GEMINI_KEY;
        if (!apiKey) {
          console.error('VITE_GEMINI_KEY not set');
          return;
        }

        const ai = new GoogleGenAI({ apiKey });

        const sdkHistory = (formattedHistory || []).map((item) => ({
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
          },
        });

        setAiReady(true);
      } catch (err) {
        console.error('Failed to initialize Gemini:', err);
      }
    };

    if (!historyLoading && formattedHistory.length >= 0) {
      initGemini();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyLoading, formattedHistory]);

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
    async (toolName, toolInput) => {
      const liveState = stateRef.current;
      try {
        switch (toolName) {
          case 'navigate_tabs': {
            const validTabs = ['Dashboard', 'Buy', 'Inventory', 'Builds', 'Sell', 'History', 'Settings'];
            const tab = validTabs.find(t => t.toLowerCase() === (toolInput.tabName || '').toLowerCase());
            if (tab) { setTab(tab); return `Navigated to ${tab} tab`; }
            return `Invalid tab: ${toolInput.tabName}. Valid tabs are: ${validTabs.join(', ')}`;
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
              return `Pre-filled the Buy form with ${name} (₱${cost}). Waiting for the user to review and submit it.`;
            }
            return 'Unable to pre-fill form';
          }

          case 'add_item_to_inventory': {
            const { name, cost, marketPrice, category, domain, notes } = toolInput;
            if (!name || !cost) return 'Missing name or cost — ask the user for the missing detail.';

            let photoFields = { photoUrl: '', photoRecordId: '' };
            if (pendingImageRef.current) {
              const uploaded = await uploadImageToPocketBase(pendingImageRef.current);
              if (uploaded) photoFields = uploaded;
              pendingImageRef.current = null; // consumed — don't reattach to a later unrelated add
            }

            const newPart = {
              id: cbUid(),
              name,
              category: category || 'Other',
              marketValue: marketPrice || cost,
              allocatedCost: cost,
              source: 'AI Assistant',
              bundleId: null,
              status: 'available',
              notes: notes || '',
              soldTo: '',
              photoUrl: photoFields.photoUrl,
              photoRecordId: photoFields.photoRecordId,
              domain: domain || 'pc',
              history: [{ date: cbToday(), event: `Added via AI Assistant for ${cbFmt(cost)}` }],
            };

            dispatch({ type: 'ADD_PARTS', parts: [newPart] });
            toast?.(`${name} added to inventory ✓`, 'success');
            return `Added "${name}" to inventory — cost ${cbFmt(cost)}, market value ${cbFmt(marketPrice || cost)}${photoFields.photoUrl ? ', photo attached' : ''}. It's now available in stock.`;
          }

          case 'query_pocketbase_inventory': {
            const available = liveState.parts.filter(p => p.status === 'available');
            const summary = {
              total: available.length,
              byCategory: {},
              items: available.slice(0, 15).map(p => ({
                name: p.name, category: p.category, cost: p.allocatedCost, market: p.marketValue,
              })),
            };
            available.forEach(p => { summary.byCategory[p.category] = (summary.byCategory[p.category] || 0) + 1; });
            return JSON.stringify(summary);
          }

          case 'find_sales': {
            const q = (toolInput.query || '').toLowerCase();
            const matches = liveState.sales
              .filter(s => !s.deleted)
              .filter(s => (s.name || '').toLowerCase().includes(q) || (s.buyerName || '').toLowerCase().includes(q))
              .slice(0, 10)
              .map(s => ({
                saleId: s.id,
                itemName: s.name,
                buyerName: s.buyerName || '(no buyer name)',
                salePrice: s.salePrice,
                profit: s.profit,
                date: s.date,
                alreadyReturned: !!s.returned,
              }));
            if (!matches.length) return `No transactions found matching "${toolInput.query}".`;
            return JSON.stringify(matches);
          }

          case 'delete_transaction': {
            const { saleId, returnToInventory } = toolInput;
            const sale = liveState.sales.find(s => s.id === saleId && !s.deleted);
            if (!sale) return `No active sale found with saleId "${saleId}". Call find_sales again to get the correct ID.`;
            dispatch({ type: 'DELETE_SALE', saleId, mode: returnToInventory ? 'undo-and-return' : 'record-only' });
            toast?.(`Transaction with ${sale.buyerName || 'buyer'} deleted${returnToInventory ? ' — item returned to inventory' : ''} ✓`, 'success');
            return `Deleted the sale of "${sale.name}" to ${sale.buyerName || 'the buyer'}${returnToInventory ? ', and returned the item to available inventory' : ''}.`;
          }

          case 'sell_item': {
            const { itemName, salePrice, buyerName } = toolInput;
            const q = (itemName || '').toLowerCase();
            const part = liveState.parts.find(p => p.status === 'available' && p.name.toLowerCase().includes(q));
            if (part) {
              const profit = salePrice - part.allocatedCost;
              const sale = { id: cbUid(), partId: part.id, name: part.name, cost: part.allocatedCost, salePrice, profit, buyerName: buyerName || '', date: cbToday() };
              dispatch({ type: 'SELL', mode: 'part', id: part.id, sale });
              toast?.(`${part.name} sold for ${cbFmt(salePrice)} ✓`, 'success');
              return `Sold "${part.name}" for ${cbFmt(salePrice)} — profit ${cbFmt(profit)}.`;
            }
            const build = liveState.builds.find(b => !b.dissolved && !b.sold && b.name.toLowerCase().includes(q));
            if (build) {
              const buildParts = liveState.parts.filter(p => build.partIds.includes(p.id));
              const cost = buildParts.reduce((s, p) => s + p.allocatedCost, 0);
              const profit = salePrice - cost;
              const sale = { id: cbUid(), buildId: build.id, name: build.name, cost, salePrice, profit, buyerName: buyerName || '', date: cbToday() };
              dispatch({ type: 'SELL', mode: 'build', id: build.id, sale });
              toast?.(`${build.name} sold for ${cbFmt(salePrice)} ✓`, 'success');
              return `Sold build "${build.name}" for ${cbFmt(salePrice)} — profit ${cbFmt(profit)}.`;
            }
            return `Couldn't find an available item or active build matching "${itemName}". Try query_pocketbase_inventory to see what's actually in stock.`;
          }

          case 'mark_item_defective': {
            const { itemName, reason } = toolInput;
            const q = (itemName || '').toLowerCase();
            const part = liveState.parts.find(p => (p.status === 'available' || p.status === 'in_build') && p.name.toLowerCase().includes(q));
            if (!part) return `Couldn't find an item matching "${itemName}" that isn't already sold or defective.`;
            dispatch({ type: 'MARK_DEFECTIVE', id: part.id, reason: reason || '' });
            toast?.(`${part.name} marked defective ✓`, 'warn');
            return `Marked "${part.name}" as defective — recorded a loss of ${cbFmt(part.allocatedCost)}.`;
          }

          default:
            return `Unknown tool: ${toolName}`;
        }
      } catch (err) {
        console.error(`Error executing tool ${toolName}:`, err);
        return `Error running ${toolName}: ${err.message}`;
      }
    },
    [setTab, setFormData, dispatch, toast, uploadImageToPocketBase]
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

      let response = await chatSessionRef.current.sendMessage({ message: userParts });

      let iterations = 0;
      const maxIterations = 5;
      while (iterations < maxIterations) {
        iterations++;
        const functionCalls = response.functionCalls || [];
        if (!functionCalls.length) break;

        for (const call of functionCalls) {
          const { name, args } = call;
          const result = await executeTool(name, args);
          response = await chatSessionRef.current.sendMessage({
            message: [{ functionResponse: { name, response: { result } } }],
          });
        }
      }

      const finalText = response.text || '';
      if (finalText) {
        await addMessage('model', finalText);
      }
    } catch (err) {
      console.error('Error during agent interaction loop:', err);
      toast?.('Something went wrong talking to the assistant. Try again.', 'error');
    } finally {
      setSending(false);
      setPendingMessages([]);
      pendingImageRef.current = null;
    }
  }, [input, selectedImage, aiReady, addMessage, executeTool, toast]);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !sending) {
      e.preventDefault();
      handleSend();
    }
  };

  if (historyError) {
    return (
      <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 5000 }}>
        <div style={{ background: '#ef4444', color: '#fff', padding: 12, borderRadius: 8, fontSize: 12, maxWidth: 280 }}>
          Chat error: {historyError}
        </div>
      </div>
    );
  }

  const displayMessages = [...messages, ...pendingMessages];

  return (
    <>
      {/* Floating Chat Bubble */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 20, right: 20, width: 56, height: 56, borderRadius: '50%',
          background: '#7c3aed', border: 'none', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: 24,
          boxShadow: '0 8px 24px rgba(124,58,237,0.4)', zIndex: 4999,
          transition: 'transform 0.2s, box-shadow 0.2s', transform: open ? 'scale(1.1)' : 'scale(1)',
        }}
        title="AI Assistant"
      >
        🤖
      </button>

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
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>🤖 AI Assistant</div>
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
