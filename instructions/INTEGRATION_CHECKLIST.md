# ✅ AI Agent Chatbox — Integration Checklist

Print this page and check off each step as you complete it.

---

## PHASE 1: PREPARATION ⏱️ 5 minutes

### Step 1: Get Gemini API Key
- [ ] Visit https://ai.google.dev
- [ ] Click "Get API Key" (top right)
- [ ] Sign in with your Google account
- [ ] Click "Create API Key"
- [ ] **Copy the key immediately** (it won't show again)
- [ ] Paste it somewhere safe temporarily

### Step 2: Read Documentation
- [ ] Open `README.md` (overview)
- [ ] Open `QUICKSTART.md` (5-minute summary)
- [ ] Open `FILE_PLACEMENT_MAP.md` (where files go)

### Step 3: Prepare Your Project
- [ ] Navigate to: `C:\Users\ADMIN\Documents\files\pc-trader\`
- [ ] Verify `src/` folder exists
- [ ] Verify `package.json` exists in root
- [ ] Open Git Bash or PowerShell in this directory

---

## PHASE 2: FILE INTEGRATION ⏱️ 15 minutes

### Step 4: Create Directories
- [ ] Create `src\components\` (if doesn't exist)
- [ ] Create `src\hooks\` (if doesn't exist)

**Commands:**
```bash
mkdir src\components
mkdir src\hooks
```

### Step 5: Copy Code Files
- [ ] Copy `App.jsx` → `src/App.jsx` (REPLACE existing)
- [ ] Copy `AIAgentChatbox.jsx` → `src/components/AIAgentChatbox.jsx` (NEW)
- [ ] Copy `useChatHistory.js` → `src/hooks/useChatHistory.js` (NEW)
- [ ] Copy `package.json` → `package.json` (REPLACE existing)

**Verify files exist:**
```bash
dir src\components\AIAgentChatbox.jsx
dir src\hooks\useChatHistory.js
```

### Step 6: Create .env File
- [ ] Create new file: `.env` in project root (next to `package.json`)
- [ ] Copy this content:

```
VITE_GEMINI_KEY=your_api_key_here
VITE_PB_URL=http://localhost:8090
```

- [ ] **Replace** `your_api_key_here` with your actual Gemini key from Step 1
- [ ] **Save the file** (NOT `.env.txt` — must be `.env`)

**Verify:**
```bash
type .env
```

Should show your VITE_GEMINI_KEY line.

### Step 7: Create PocketBase Collection
- [ ] Start PocketBase (if not already running)
- [ ] Open PocketBase admin: `http://localhost:8090/_/`
- [ ] Click **Collections** → **Create**
- [ ] **Name**: `chat_messages`
- [ ] Click **Create**
- [ ] Click **+ Add Field**
  - [ ] Name: `role`
  - [ ] Type: `Text`
  - [ ] Click **Save**
- [ ] Click **+ Add Field**
  - [ ] Name: `text`
  - [ ] Type: `Text`
  - [ ] Click **Save**
- [ ] Click **Save** (collection save)

---

## PHASE 3: INSTALLATION ⏱️ 5 minutes

### Step 8: Clean Install Node Modules
- [ ] Open terminal in project root
- [ ] Delete old files:
  ```bash
  del package-lock.json
  rmdir /s /q node_modules
  ```
- [ ] Confirm deletion when prompted

### Step 9: Install Dependencies
- [ ] Run:
  ```bash
  npm install
  ```
- [ ] Wait for completion (may take 1-2 minutes)
- [ ] Verify no errors in output

---

## PHASE 4: TESTING ⏱️ 5 minutes

### Step 10: Start Development Server
- [ ] Run:
  ```bash
  npm run dev
  ```
- [ ] Wait for "ready in Xs"
- [ ] Note the local URL (usually `http://localhost:5173`)

### Step 11: Test in Browser
- [ ] Open `http://localhost:5173` in your browser
- [ ] **Look for 🤖 bubble in bottom-right corner**
  - [ ] Bubble is visible ✓
- [ ] Click the 🤖 bubble
  - [ ] Chat drawer slides up ✓
- [ ] Type "Hello"
- [ ] Click "Send" (or press Enter)
  - [ ] Gemini responds ✓
- [ ] Try: "Switch to Inventory"
  - [ ] App switches to Inventory tab ✓
- [ ] Close browser console (if it opened)
- [ ] Refresh page (Ctrl+R or Cmd+R)
  - [ ] Old messages still visible ✓

### Step 12: Check Console for Errors
- [ ] Press F12 or Ctrl+Shift+J to open console
- [ ] Look for red error messages
  - [ ] No errors (or only unrelated warnings) ✓
- [ ] Close console

---

## PHASE 5: DEPLOYMENT ⏱️ 5 minutes

### Step 13: Commit to Git
- [ ] In terminal, verify git is ready:
  ```bash
  git status
  ```
- [ ] Should show modified `package.json`, `src/App.jsx` and new files
- [ ] Stage changes:
  ```bash
  git add .
  ```
- [ ] Commit:
  ```bash
  git commit -m "feat: Add AI Agent Chatbox with Gemini integration"
  ```
- [ ] Push to GitHub:
  ```bash
  git push
  ```

### Step 14: Railway Deployment
- [ ] Open Railway dashboard
- [ ] Go to **PC Trader service** → **Settings** → **Variables**
- [ ] **Add Variable:**
  - [ ] Name: `VITE_GEMINI_KEY`
  - [ ] Value: Your Gemini API key
  - [ ] Save
- [ ] **Add Variable:**
  - [ ] Name: `VITE_PB_URL`
  - [ ] Value: Your Railway PocketBase URL (e.g., `https://pocketbase-production-xxx.up.railway.app`)
  - [ ] Save
- [ ] Watch deployment (should start automatically after 1-2 minutes)

### Step 15: Test on Live Site
- [ ] Open your live Railway URL
- [ ] Look for 🤖 bubble
  - [ ] Visible on live site ✓
- [ ] Click bubble and test chat
  - [ ] Can send messages ✓
  - [ ] Gemini responds ✓
  - [ ] Messages save ✓
- [ ] Refresh page
  - [ ] Old messages still visible ✓

---

## ✅ FINAL VERIFICATION

- [ ] All 5 phases completed
- [ ] 🤖 bubble visible locally
- [ ] 🤖 bubble visible on live Railway site
- [ ] Chat works in both places
- [ ] Messages persist after refresh
- [ ] No errors in console
- [ ] `.env` NOT committed to git
- [ ] VITE_GEMINI_KEY set on Railway
- [ ] VITE_PB_URL set on Railway

---

## 🎉 SUCCESS!

You now have:
✅ AI Agent Chatbox integrated
✅ Persistent memory (PocketBase)
✅ Free Gemini API ($0 cost)
✅ Mobile-responsive UI
✅ Function calling enabled
✅ Image vision input
✅ Deployed to production

**Enjoy your AI assistant!** 🤖

---

## 🆘 TROUBLESHOOTING

| Problem | Solution |
|---------|----------|
| "AI agent not ready" | Check `.env` file exists with VITE_GEMINI_KEY |
| "Chat messages collection not found" | Create `chat_messages` collection in PocketBase |
| 🤖 bubble not visible | Restart dev server: `npm run dev` |
| Messages not loading | Verify PocketBase is running (check `http://localhost:8090`) |
| npm install fails | Delete `node_modules`, `package-lock.json`, retry |
| Function calls ignored | Be explicit: "Switch to Inventory" (not "go to inventory") |

---

## 📋 Quick Command Reference

```bash
# Start dev server
npm run dev

# Commit changes
git add .
git commit -m "feat: [description]"
git push

# Check if files exist
dir src\components\AIAgentChatbox.jsx
dir src\hooks\useChatHistory.js

# View .env contents
type .env

# Clear node_modules
rmdir /s /q node_modules
del package-lock.json
npm install
```

---

## ⏱️ Timeline Summary

| Phase | Time | Status |
|-------|------|--------|
| Preparation | 5 min | _____ |
| Integration | 15 min | _____ |
| Installation | 5 min | _____ |
| Testing | 5 min | _____ |
| Deployment | 5 min | _____ |
| **TOTAL** | **25 min** | _____ |

---

## 📞 Questions?

See documentation files:
- **README.md** — Overview
- **QUICKSTART.md** — Quick reference
- **FILE_PLACEMENT_MAP.md** — Where files go
- **DEPLOYMENT_GUIDE.md** — Detailed steps
- **AI_AGENT_SETUP.md** — Troubleshooting

---

**Print this checklist and check items as you complete them!** ✅
