# 🚀 AI Agent Chatbox — Deployment Guide

Complete step-by-step instructions to integrate the AI chatbox into your PC Trader app.

---

## 📋 Prerequisites

- Node.js 16+
- Git (for pushing to Railway)
- PocketBase running (local or Railway)
- Gemini API key from [ai.google.dev](https://ai.google.dev)

---

## 🔧 Integration Steps

### Step 1: Copy Files to Your Project

From the files provided, copy these into your PC Trader project:

```
Your Project Root (C:\Users\ADMIN\Documents\files\pc-trader\)
├── src/
│   ├── App.jsx                    ← REPLACE with new App.jsx
│   ├── components/
│   │   └── AIAgentChatbox.jsx     ← NEW: Copy here
│   └── hooks/
│       └── useChatHistory.js      ← NEW: Copy here
├── package.json                   ← REPLACE with new package.json
├── .env                           ← CREATE if doesn't exist (see Step 2)
└── .env.example                   ← NEW: For reference
```

**Important**: Make sure directories exist:
- `src/components/` (if not already there, create it)
- `src/hooks/` (if not already there, create it)

### Step 2: Create `.env` File

In the root of your project, create `.env` (next to `package.json`):

```bash
# Windows (use Notepad, save as .env)
VITE_GEMINI_KEY=AIzaSy_your_actual_key_here
VITE_PB_URL=http://localhost:8090
```

Replace `AIzaSy_your_actual_key_here` with your actual Gemini API key from [ai.google.dev](https://ai.google.dev).

**Important**: This file is git-ignored, so it won't be committed to GitHub.

### Step 3: Install Dependencies

```bash
cd C:\Users\ADMIN\Documents\files\pc-trader

# Clean install
del package-lock.json
rmdir /s /q node_modules

# Install fresh
npm install
```

This will install:
- `@google/generative-ai` (new Gemini SDK)
- All existing dependencies

### Step 4: Create PocketBase Collection

#### Option A: Local PocketBase

1. Start PocketBase locally
2. Open admin: `http://localhost:8090/_/`
3. Click **Collections** → **Create**
4. **Name**: `chat_messages`
5. Click **Create**
6. Add fields:
   - **role** (Text) — required
   - **text** (Text) — required
7. Click **Save**

#### Option B: Railway PocketBase

Same steps, but use your Railway PocketBase URL:
`https://pocketbase-production-xxxx.up.railway.app/_/`

### Step 5: Test Locally

```bash
npm run dev
```

Open `http://localhost:5173`:
- Look for 🤖 bubble in bottom-right corner
- Click it
- Type "Hello"
- Gemini should respond

If you see errors:
- Check `.env` file exists with correct key
- Check PocketBase collection `chat_messages` exists
- Check browser console for error messages

### Step 6: Commit to Git

```bash
cd C:\Users\ADMIN\Documents\files\pc-trader

git status
git add .
git commit -m "feat: Add AI Agent Chatbox with Gemini integration

- Add AIAgentChatbox component with floating bubble UI
- Add useChatHistory hook for PocketBase persistence  
- Integrate Gemini Flash API for free-tier inference
- Add function calling for app control (navigate tabs, pre-fill forms, query inventory)
- Add image vision input for hardware detection
- Mobile-first responsive design
- Zero additional cost (free Gemini tier)"

git push
```

**Railway will auto-redeploy!** ✅

### Step 7: Configure Production Environment

Go to **Railway Dashboard** → **PC Trader service** → **Settings** → **Variables**

Add/update:

```
VITE_GEMINI_KEY = AIzaSy_your_actual_key_here
VITE_PB_URL = https://pocketbase-production-xxxx.up.railway.app
```

(Replace with your actual values)

### Step 8: Verify on Railway

Once deployed:
1. Visit your live site
2. Check bottom-right corner for 🤖 bubble
3. Click and test

---

## 📁 File Mapping Reference

| File | Location | Action |
|------|----------|--------|
| `App.jsx` | `src/App.jsx` | **REPLACE** |
| `AIAgentChatbox.jsx` | `src/components/AIAgentChatbox.jsx` | **NEW** (create folder if needed) |
| `useChatHistory.js` | `src/hooks/useChatHistory.js` | **NEW** (create folder if needed) |
| `package.json` | `package.json` | **REPLACE** |
| `.env.example` | `.env.example` | **NEW** (reference only, for git) |
| Documentation | Project root | **NEW** (reference only) |

---

## 🆘 Troubleshooting

### Issue: "AI agent not ready yet" on page

**Cause**: Gemini API key is missing or invalid

**Solution**:
1. Verify `.env` file exists in project root (next to `package.json`)
2. Verify `VITE_GEMINI_KEY` has your actual Gemini key (from ai.google.dev)
3. Restart dev server: `npm run dev`
4. Check browser console for specific error

### Issue: "Chat messages collection not found"

**Cause**: PocketBase `chat_messages` collection doesn't exist

**Solution**:
1. Open PocketBase admin: `http://localhost:8090/_/`
2. Click **Collections**
3. Verify `chat_messages` exists
4. If missing, create it:
   - Click **Create**
   - Name: `chat_messages`
   - Add fields: `role` (Text), `text` (Text)
   - Save

### Issue: Messages not loading from PocketBase

**Cause**: API access denied or wrong URL

**Solution**:
1. Verify `VITE_PB_URL` in `.env` is correct
2. Open `http://localhost:8090` to verify PocketBase is running
3. In PocketBase admin, go to `chat_messages` collection → **API Rules**
4. Ensure **Read** and **Create** are allowed (✓)
5. Save

### Issue: Image upload not working

**Cause**: File too large or wrong format

**Solution**:
1. Use JPG or PNG only
2. Keep image under 20 MB
3. Try a smaller/different image

### Issue: Function calls not executing (e.g., "Switch to Inventory" doesn't work)

**Cause**: Gemini doesn't understand intent or tool name mismatch

**Solution**:
1. Be explicit: Say "Switch to the Inventory tab" instead of "go to inventory"
2. Check browser console for function call details
3. Try exact tab names: Dashboard, Buy, Inventory, Builds, Sell, History, Settings

---

## 🔄 Update Workflow (Future)

If you update the chatbox later:

```bash
# Make changes to AIAgentChatbox.jsx or other files
# Test locally
npm run dev

# Commit and push
git add .
git commit -m "fix: [description]"
git push

# Railway auto-redeploys
# Check live site after ~1 minute
```

---

## ✅ Verification Checklist

Before declaring success:

- [ ] `.env` file created with `VITE_GEMINI_KEY` and `VITE_PB_URL`
- [ ] `npm install` completed without errors
- [ ] `npm run dev` runs without errors
- [ ] 🤖 bubble visible in bottom-right corner at `http://localhost:5173`
- [ ] Clicking bubble opens chat drawer
- [ ] Typing "Hello" gets a response from Gemini
- [ ] "Switch to Inventory" navigates to Inventory tab
- [ ] Image upload works (or at least file picker appears)
- [ ] Messages persist after page refresh
- [ ] Browser console shows no errors (Ctrl+Shift+J)
- [ ] `git push` succeeds
- [ ] Railway redeploys (check dashboard)
- [ ] 🤖 bubble visible on live Railway site
- [ ] Live site chat works

---

## 📚 Documentation Reference

For detailed information, see:

1. **QUICKSTART.md** — 5-minute setup overview
2. **AI_AGENT_SETUP.md** — Detailed installation walkthrough
3. **AI_AGENT_IMPLEMENTATION.md** — Technical architecture + code reference
4. **IMPLEMENTATION_SUMMARY.md** — Feature overview + use cases

---

## 🎯 Next Steps

### Immediate (Today)
1. Follow Steps 1-5 above
2. Test locally
3. Commit and push

### Short-term (This week)
1. Test function calling thoroughly
2. Test image vision with hardware photos
3. Monitor Gemini API usage (should be free)

### Medium-term (Next sprint)
1. Add custom system prompt to teach Gemini about your hardware business
2. Add more tools (mark defective, create bundles, etc.)
3. Monitor conversation quality
4. Gather user feedback

### Long-term (Roadmap)
1. Multi-user support (separate conversations per user)
2. Analytics (common questions, tool usage)
3. Offline support (cache + sync)
4. Integration with other APIs (CoinGecko for pricing, etc.)

---

## 💰 Cost Verification

**Your setup uses:**
- Gemini 2.5 Flash: Free tier (60 req/min)
- PocketBase: Already have it
- Total cost: **$0** ✅

**If you exceed free tier** (unlikely):
- Gemini 1.5 Pro: $0.075 per 1M input tokens
- 100 conversations/day ≈ $0.05/month

---

## 🆘 Getting Help

### Resources
- Gemini API docs: [ai.google.dev/docs](https://ai.google.dev/docs)
- PocketBase docs: [pocketbase.io](https://pocketbase.io)
- React docs: [react.dev](https://react.dev)

### Common Commands

```bash
# Check if PocketBase is running
curl http://localhost:8090

# Check environment variables are loaded
npm run dev  # Look at console for "Gemini key detected"

# Clear node_modules and reinstall (if things break)
rmdir /s /q node_modules
del package-lock.json
npm install

# View Git status before committing
git status

# See last few commits
git log --oneline -5
```

---

## 📊 Success Metrics

You'll know it's working when:

1. ✅ 🤖 bubble appears on page load
2. ✅ Chat drawer opens on tap
3. ✅ Typing gets AI response within 2 seconds
4. ✅ Messages appear in conversation thread
5. ✅ Refreshing page loads old messages
6. ✅ "Switch to Inventory" actually switches tabs
7. ✅ Image upload accepts photos
8. ✅ No errors in browser console
9. ✅ Same functionality works on Railway live site
10. ✅ Gemini API bill is still $0

---

## 🎉 You're Done!

Once you see the 🤖 bubble working on both local and live sites, you've successfully:

✅ Integrated Gemini Flash API (free tier)
✅ Set up persistent memory via PocketBase
✅ Implemented function calling for app control
✅ Added image vision for hardware detection
✅ Created mobile-responsive UI
✅ Deployed to production

**Total time**: 30-45 minutes
**Total cost**: $0

Now you have an AI assistant that understands your PC trading business and can control your app! 🚀

---

**Questions?** Check the other documentation files or reach out on GitHub.

**Ready to integrate?** Start with Step 1 above!
