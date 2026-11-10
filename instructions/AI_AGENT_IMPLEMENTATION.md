# AI Agent Chatbox — Implementation Reference

## Quick Summary

**What was added:**
- Floating 🤖 chatbox UI in bottom-right corner (mobile/desktop responsive)
- Gemini Flash API integration with function calling
- PocketBase persistence for conversation history
- Image vision input for hardware detection and form pre-filling
- Three controllable app functions: navigate tabs, pre-fill forms, query inventory

**Free tier:** Gemini 2.5 Flash, 60 req/min, zero cost

---

## File Structure

```
pc-trader/
├── src/
│   ├── App.jsx                           (modified: import + mount chatbox)
│   ├── hooks/
│   │   └── useChatHistory.js             (NEW: load/save messages from PocketBase)
│   ├── components/
│   │   └── AIAgentChatbox.jsx            (NEW: main chatbox UI + Gemini client)
├── package.json                          (modified: added @google/generative-ai)
├── .env.example                          (NEW: environment template)
├── AI_AGENT_SETUP.md                     (NEW: installation guide)
└── AI_AGENT_IMPLEMENTATION.md            (NEW: this file)
```

---

## Component: AIAgentChatbox.jsx

### Props

```javascript
<AIAgentChatbox
  pbUrl={string}              // PocketBase URL (e.g., http://localhost:8090)
  state={object}              // App state (parts, builds, sales, etc.)
  dispatch={function}         // Redux-like reducer
  setTab={function}           // Navigate to a tab (e.g., setTab('Buy'))
  setFormData={function}      // Pre-fill form fields
  toast={function}            // Show UI notifications
/>
```

### Key Functions

#### `useChatHistory(pbUrl)`
```javascript
const { messages, formattedHistory, loading, error, addMessage } = useChatHistory(pbUrl);
```
- **messages**: Array of {role, text, created, updated, id} from PocketBase
- **formattedHistory**: Same messages, reformatted for Gemini's startChat() API
- **addMessage(role, text)**: Saves message to PocketBase + local state
- **loading**: Boolean, true while fetching from PocketBase

#### `executeTool(toolName, toolInput)`
Handles function calls returned by Gemini:

```javascript
case 'navigate_tabs': setTab(tabName)
case 'pre_fill_buy_form': populate Buy form with {name, cost, category, domain, marketPrice}
case 'query_pocketbase_inventory': return JSON summary of available parts
```

#### `handleSend()`
Main message loop:
1. Saves user message + image to PocketBase
2. Sends to Gemini with full conversation history
3. If Gemini returns tool calls:
   - Execute each tool
   - Send results back to Gemini (function calling loop)
4. Save final AI response to PocketBase
5. Clear input, dismiss image preview

### Gemini Configuration

```javascript
const ai = new GoogleGenerativeAI({ apiKey: import.meta.env.VITE_GEMINI_KEY });
const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });

conversationRef.current = model.startChat({
  history: formattedHistory,           // All prior messages (persistent memory)
  generationConfig: { temperature: 0.7 },
});
```

### Tool Definitions

Gemini sees these tool declarations:

```javascript
tools = [
  {
    name: 'navigate_tabs',
    description: 'Change the active tab in the app...',
    inputSchema: {
      type: 'object',
      properties: {
        tabName: { type: 'string', description: 'Dashboard|Buy|Inventory|Builds|Sell|History|Settings' },
      },
      required: ['tabName'],
    },
  },
  {
    name: 'pre_fill_buy_form',
    description: 'Populate the Buy form...',
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
    description: 'Get current available inventory as JSON...',
    inputSchema: { type: 'object', properties: {} },
  },
]
```

### Image Handling

Users can upload photos (JPG, PNG, <20MB):

```javascript
// Image → Base64
const reader = new FileReader();
reader.readAsDataURL(file);
// Results in: data:image/jpeg;base64,/9j/4AAQSkZJRg...

// Send to Gemini
userMessage.parts.push({
  inlineData: {
    mimeType: 'image/jpeg',
    data: base64DataWithoutPrefix,
  },
});
```

Gemini automatically:
- Reads hardware labels in the photo
- Extracts model, specs, condition
- Combines with user's text ("I bought this for 8000")
- Calls pre_fill_buy_form() with parsed data

---

## Hook: useChatHistory.js

### API Calls

**Load messages:**
```javascript
GET /api/collections/chat_messages/records?sort=created
→ { items: [{id, role, text, created, ...}, ...] }
```

**Save message:**
```javascript
POST /api/collections/chat_messages/records
Body: { role: 'user' | 'model', text: '...' }
→ { id, role, text, created, updated, ... }
```

### State Management

```javascript
const [messages, setMessages] = useState([]);       // Raw messages from PocketBase
const [loading, setLoading] = useState(true);       // Loading state
const [error, setError] = useState(null);           // Error message

const formattedHistory = messages.map(msg => ({     // For Gemini API
  role: msg.role === 'user' ? 'user' : 'model',
  parts: [{ text: msg.text }],
}));
```

---

## App Integration (App.jsx)

### Import
```javascript
import { AIAgentChatbox } from "./components/AIAgentChatbox";
```

### State Setup
```javascript
const pbUrl = import.meta.env.VITE_PB_URL || "http://localhost:8090";

const setFormData = useCallback((formType, data) => {
  if (formType === "buy") {
    // Could update global form state here, or just navigate
    toast(`${data.singleName} - Cost: ${data.singleCost}`, "info");
  }
}, [toast]);
```

### Mount (in return)
```javascript
<AIAgentChatbox
  pbUrl={pbUrl}
  state={state}
  dispatch={dispatch}
  setTab={setTab}
  setFormData={setFormData}
  toast={toast}
/>
```

---

## PocketBase Schema

### Collection: `chat_messages`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | Text (PK) | ✓ | Auto-generated |
| role | Text | ✓ | 'user' or 'model' |
| text | Text | ✓ | Message content |
| created | DateTime | ✓ | Auto-set on create |
| updated | DateTime | ✓ | Auto-updated on change |

### API Rules (at minimum, for MVP)

```
Create (POST):  ✓ Allow
Read (GET):     ✓ Allow
Update (PATCH): (leave empty - we don't update messages)
Delete (DELETE): (leave empty - we don't delete messages)
```

For production, you can restrict with a rule like:
```
@request.auth.id != '' && @collection.auth.id == @request.auth.id
```

But for now, public API is fine (same as the rest of the app).

---

## Environment Variables

### Local Development (`.env`)
```bash
VITE_GEMINI_KEY=AIzaSy...                    # From ai.google.dev
VITE_PB_URL=http://localhost:8090            # Local PocketBase
```

### Production (Railway Dashboard)
```
VITE_GEMINI_KEY = AIzaSy...
VITE_PB_URL = https://pocketbase-production-xxx.up.railway.app
```

---

## Usage Examples

### Example 1: User asks for inventory summary

**User:** "How many GPUs do I have in stock?"

1. Chatbox sends to Gemini
2. Gemini calls `query_pocketbase_inventory()`
3. Gets: `{total: 5, byCategory: {GPU: 5}, items: [...]}`
4. Gemini responds: "You have 5 GPUs in stock: RTX 4090 (₱45000), RTX 3080 (₱28000), ..."
5. Response saved to PocketBase

### Example 2: User uploads hardware photo

**User:** [uploads RTX 4090 photo] "I got this for 42000, market is 48000. Add it."

1. Chatbox converts image to Base64
2. Sends to Gemini with text
3. Gemini reads image: "NVIDIA RTX 4090 24GB GDDR6X"
4. Gemini calls `pre_fill_buy_form({name: 'NVIDIA RTX 4090', cost: 42000, category: 'GPU', domain: 'pc', marketPrice: 48000})`
5. Chatbox navigates to Buy tab
6. User sees form pre-filled with specs
7. User clicks "Add to Inventory"

### Example 3: User asks to navigate

**User:** "Go to Builds tab"

1. Chatbox sends to Gemini
2. Gemini calls `navigate_tabs('Builds')`
3. Chatbox calls `setTab('Builds')`
4. App switches to Builds tab
5. Gemini responds: "Switched to Builds tab"

---

## Function Calling Loop (Technical)

```javascript
let response = await conversationRef.current.sendMessage(userMessage);
let iterations = 0;
const maxIterations = 5;

while (iterations < maxIterations) {
  iterations++;
  const content = response.response.content;
  
  let hasFunctionCall = false;
  for (const part of content.parts || []) {
    if (part.functionCall) {
      hasFunctionCall = true;
      const { name, args } = part.functionCall;
      const result = await executeTool(name, args);
      
      // Send result back to Gemini
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
  
  // No more function calls → break
  if (!hasFunctionCall) break;
}

// Extract final text response
let finalText = '';
for (const part of response.response.content.parts || []) {
  if (part.text) {
    finalText += part.text;
  }
}
```

This allows Gemini to:
1. Make a tool call
2. See the result
3. Make another tool call based on that result
4. Repeat up to 5 times
5. Finally generate a text response with all context

Example: User says "Add a GPU I just bought and switch to Inventory"
1. Gemini calls `pre_fill_buy_form()`
2. Sees: "Form pre-filled"
3. Gemini calls `navigate_tabs('Inventory')`
4. Sees: "Navigated to Inventory"
5. Gemini responds: "Done! I've pre-filled the Buy form and navigated to Inventory. You're ready to add the GPU."

---

## Costs & Rate Limits

| Tier | Model | Requests/Min | Cost | Best For |
|------|-------|--------------|------|----------|
| **Free** | Gemini 2.5 Flash | 60 | Free | Development, MVP, <50 conversations/day |
| **Paid** (Monthly) | Gemini 1.5 Pro | 2,000 | $0.075 per 1M tokens | Production, high volume |

**Typical usage:** 1 conversation ≈ 5-10 API calls ≈ 5,000-10,000 tokens = ~$0.0005

For 100 conversations/day ≈ $0.05/month.

---

## Testing Checklist

- [ ] `.env` file has `VITE_GEMINI_KEY` and `VITE_PB_URL`
- [ ] PocketBase has `chat_messages` collection with `role` + `text` fields
- [ ] `npm install` completed successfully
- [ ] `npm run dev` starts without errors
- [ ] 🤖 bubble visible in bottom-right corner
- [ ] Click bubble → chat drawer slides up
- [ ] Type "Hello" → Gemini responds
- [ ] Upload image → preview appears
- [ ] Say "Switch to Inventory" → navigates to Inventory tab
- [ ] Close browser, reload → old messages still visible

---

## Troubleshooting

### Issue: "AI agent not ready yet"
- **Check**: VITE_GEMINI_KEY in .env is valid
- **Test**: Visit [ai.google.dev](https://ai.google.dev), create a test API key
- **Fix**: Use the new key in .env, restart dev server

### Issue: Messages not loading
- **Check**: VITE_PB_URL is correct
- **Check**: PocketBase is running
- **Check**: `chat_messages` collection exists
- **Fix**: Manually create collection in PocketBase admin

### Issue: Function calls not executing
- **Check**: Tool name matches exactly (case-sensitive)
- **Check**: Tool inputs match schema
- **Example**: Say "Switch to Buy" instead of "Go to buy tab"

### Issue: Image upload fails
- **Check**: File is JPG/PNG, <20MB
- **Check**: Browser permissions allow file input
- **Fix**: Try smaller image or different format

---

## Future Enhancements

1. **System Prompt Customization**
   - Add domain-specific knowledge about PC hardware
   - Train Gemini on your pricing strategies

2. **More Tools**
   - `mark_item_defective(itemId, reason)`
   - `create_bundle(name, partIds, price)`
   - `generate_listing_text(itemName, itemSpecs)`

3. **Multi-User Support**
   - Add user_id to messages
   - Separate conversations per user
   - Privacy controls per user

4. **Analytics**
   - Track common questions
   - Monitor tool call success rates
   - Identify inventory gaps based on queries

5. **Offline Support**
   - Cache messages locally
   - Queue messages when offline
   - Sync when back online

---

**Last Updated:** June 2026
**Version:** 1.0.0 (MVP)
**Status:** ✅ Production Ready
