# 🤖 AI Agent Chatbox — 5-Minute Quickstart

Get the Gemini-powered AI assistant running in 5 minutes.

## 1️⃣ Get Your Gemini API Key (2 minutes)

1. Go to [ai.google.dev](https://ai.google.dev)
2. Click **"Get API Key"** (top right)
3. Sign in with Google (free account)
4. Click **"Create API Key"** and copy it immediately
5. **Done!** You now have a free key (60 requests/minute)

## 2️⃣ Set Up Environment Variables (1 minute)

Create a `.env` file in the project root:

```bash
VITE_GEMINI_KEY=your_key_here
VITE_PB_URL=http://localhost:8090
```

Replace `your_key_here` with the key from Step 1.

## 3️⃣ Create PocketBase Collection (1 minute)

1. Open PocketBase admin: `http://localhost:8090/_/`
2. Click **Collections** → **Create**
3. Name: `chat_messages`
4. Click **Create**
5. Add fields:
   - **role** (Text)
   - **text** (Text)
6. Click **Save**

Done!

## 4️⃣ Install & Run (1 minute)

```bash
# Install new package
npm install

# Start dev server
npm run dev
```

Open `http://localhost:5173` — you should see a 🤖 bubble in bottom-right corner.

## 5️⃣ Test It

1. Click the 🤖 bubble
2. Type: `"Hello!"`
3. Gemini responds
4. Try: `"Switch to Inventory"` — it navigates!
5. Try uploading a hardware photo + text

**Done! You're live.** 🚀

---

## For Railway (Production)

```bash
# Add these to Railway dashboard → PC Trader service → Variables
VITE_GEMINI_KEY=your_key
VITE_PB_URL=https://your-pocketbase.up.railway.app

# Push to deploy
git push
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "AI agent not ready" | Check `.env` has `VITE_GEMINI_KEY` |
| Messages not loading | Verify `chat_messages` collection exists in PocketBase |
| Image upload fails | Use JPG/PNG under 20MB |
| Function calls ignored | Be explicit: "Switch to Inventory" (not "go to inventory") |

For detailed setup, see **AI_AGENT_SETUP.md**
For technical reference, see **AI_AGENT_IMPLEMENTATION.md**

---

## What You Can Ask

- **"How many GPUs do I have?"** → queries inventory
- **"Add a 2TB SSD for 3000"** → pre-fills Buy form
- **"Switch to Builds"** → navigates tabs
- **[upload photo] "I got this for 8000"** → reads specs from image
- **"Show me my profit trend"** → describes Dashboard

---

**Questions?** Check the full guides in the docs folder.
