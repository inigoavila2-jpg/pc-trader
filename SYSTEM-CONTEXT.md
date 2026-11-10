# PC Trader — Full System Context

This document explains the entire system end to end: what it is, how the pieces fit together, where everything lives, and the current status. Use it to get back up to speed at any point, or hand it to anyone (including a future AI assistant) who needs to pick up where this left off.

---

## 1. What this is

A web app for tracking PC parts trading: buying bundles or single parts, building them into sellable PCs, recording sales, and tracking profit. Runs in any browser — phone or PC — because it's deployed as a live website, not a local-only program.

**Live app URL:** check Railway dashboard → `pc-trader` service → Settings → Networking. (The PocketBase admin panel is a separate URL — see below.)

**Tech stack:**
- **Frontend:** React, built with Vite, styled with inline JS styles (no CSS framework)
- **Backend:** A small Express (Node.js) server that bridges the frontend to the database
- **Database:** PocketBase (a single-binary database with a built-in admin UI), hosted as its own Railway service
- **Hosting:** Railway, two separate services in one project — one for the app, one for PocketBase
- **Source control:** GitHub — pushing to `main` triggers an automatic redeploy on Railway

---

## 2. Architecture — how data flows

```
Browser (phone or PC)
   │
   │  HTTP requests
   ▼
Express server (server.js)  ──── runs on Railway as the "pc-trader" service
   │
   │  Authenticates as PocketBase superuser, then makes API calls
   ▼
PocketBase  ──── runs on Railway as its own separate service, has its own URL
   │
   ▼
Single SQLite file inside the PocketBase container (persists across restarts
because Railway gives each service its own disk)
```

**Why a server sits in between, instead of the browser talking to PocketBase directly:** PocketBase admin credentials must never be exposed to the browser. The Express server holds those credentials (via environment variables) and proxies requests, so the browser only ever talks to `/data` and `/photo` on our own server — never to PocketBase directly with admin rights.

**Data model:** Almost all app data (parts, bundles, builds, sales, settings) lives as **one JSON blob** in a single PocketBase collection called `store`, inside one record. The whole blob is fetched on page load and the whole blob is re-saved (debounced, 500ms after the last change) on every edit. This is intentionally simple — no relational schema, no per-record queries — appropriate for a single-user tracker with a few hundred parts at most.

**Photos are the one exception** — they live in a separate PocketBase collection called `photos`, one file per record. A part/bundle/build stores just the resulting file's URL (a string) inside the JSON blob, not the image bytes themselves. This keeps the main JSON blob small and fast to save.

---

## 3. File-by-file reference

| File | Role |
|---|---|
| `index.html` | Vite entry point. Sets viewport, theme-color, and a dark background directly on `html`/`body` (fixes white edges on mobile browsers). |
| `src/main.jsx` | Mounts the React app into `#root`. |
| `src/App.jsx` | The entire frontend — one file containing the reducer, all components (Dashboard, Buy, Inventory, Builds, Sell, History, Settings), and the photo upload/display components. ~1,300 lines, deliberately monolithic for a project this size rather than split into many files. |
| `server.js` | Express server. Authenticates to PocketBase as a superuser, exposes `/data` (GET/POST) for the JSON blob, `/photo` (POST/DELETE) for image uploads, `/health` for Railway's healthcheck, and serves the built frontend (`dist/`) for everything else. |
| `setup-db.js` | One-time setup script. Logs into PocketBase and creates the two collections (`store` and `photos`) if they don't already exist. Safe to re-run. |
| `package.json` | Dependencies (`express`, `multer`, `react`, `react-dom`, `vite`, `@vitejs/plugin-react`) pinned to exact versions — no `^` ranges — so a fresh `npm install` always produces the same thing locally and on Railway. |
| `vite.config.js` | Minimal Vite config, just the React plugin. |
| `railway.toml` | Tells Railway to build with Nixpacks, run `node server.js` to start, and healthcheck `/health`. |
| `nixpacks.toml` | Tells the build step to run `npm install && npm run build` before starting. |
| `.gitignore` | Excludes `node_modules/` and `dist/` from git — **critical**, see Section 6 for why. |

---

## 4. PocketBase collections

**`store`** — one record, one field:
- `data` (json, required) — the entire app state blob: `{ bundles, parts, builds, sales, settings }`

**`photos`** — one record per uploaded photo:
- `image` (file, required, max 1 file, max 5MB) — the actual image

PocketBase auto-generates a public URL for each file: `{PB_URL}/api/files/photos/{recordId}/{filename}`. The server returns this URL to the frontend after upload, and that URL is what gets stored on the part/bundle/build object.

---

## 5. Environment variables (set on the **app** service in Railway, not PocketBase)

| Variable | Value | Purpose |
|---|---|---|
| `PB_URL` | `https://pocketbase-production-dfdc.up.railway.app` | Where the app's server reaches PocketBase |
| `PB_ADMIN_EMAIL` | (inigoavila2@gmail.com) | Used by the server to authenticate to PocketBase |
| `PB_ADMIN_PASS` | (Idkpassword093) | Same |

**Security note:** These credentials grant full admin access to the database. They should only ever live in Railway's environment variables — never committed to GitHub, never pasted in chat logs or screenshots. If a password is ever exposed (e.g. accidentally pasted somewhere), rotate it immediately via the PocketBase admin panel (`{PB_URL}/_/`) and update the Railway variable to match.

---

## 6. The `.gitignore` issue (already fixed, documented for reference)

Early on, `node_modules/` and `dist/` were accidentally committed to GitHub. This broke Railway's build because:
1. Git doesn't preserve Unix executable permissions on files like `node_modules/.bin/vite`
2. When Railway cloned the repo, `vite` came in as a non-executable file → `Permission denied` at build time

**Fix applied:** added `.gitignore` (excludes `node_modules/`, `dist/`, `.env`, logs) and ran `git rm -r --cached node_modules dist` to untrack them without deleting them locally. `node_modules` should never be committed — it's always regenerated from `package.json` via `npm install` on whatever machine needs it (your PC, or Railway's build server).

---

## 7. Known issues encountered so far (chronological, for debugging history)

1. **Old PocketBase API endpoints** — early drafts used `/api/admins/auth-with-password` and a `schema` key for collections. Both are from PocketBase versions older than v0.23. Current PocketBase uses `/api/collections/_superusers/auth-with-password` and a `fields` key. Fixed in `setup-db.js` and `server.js`.
2. **`npm ci` peer dependency conflict** — `vite@8` was pinned in a stale lockfile, incompatible with `@vitejs/plugin-react@4.7.0` (which only supports Vite 4–7). Fixed by pinning exact compatible versions (`vite@5.4.11`, `@vitejs/plugin-react@4.3.4`) and regenerating the lockfile.
3. **`node_modules`/`dist` committed to git** — see Section 6.
4. **Mobile layout squeeze** — the bundle-parts entry row used a fixed 5-column CSS grid that crushed the "Part name" input to a sliver on phones. Fixed with a `.part-row` class that collapses to a single column under 640px width, plus general safe-area/viewport fixes in `index.html`.
5. **Photo feature appeared missing after deploy** — root cause was that the new `App.jsx` got placed in the project's root folder instead of `src/App.jsx`, so the build kept compiling the old file even though build/push succeeded with no errors. **This is the actively open issue as of the last message in this conversation** — the fix (move the file into `src/`, rebuild, push) has been given but not yet confirmed resolved.

---

## 8. Feature list (current)

- Buy parts as a bundle (auto-allocates purchase price across parts by market-value share) or as a single part
- "Duplicate last bundle" — reuses the previous bundle's part names/categories for faster repeat entry
- Photo upload (from gallery) on bundles, individual parts, and finished builds — one photo each, displayed as a tilted Polaroid-style thumbnail
- Inventory with search, status filtering (available / in build / sold), Quick Sell, inline editing, notes per part
- Builds — group available parts into a named PC build; dissolve a build to return its parts to available inventory
- Sell — sell a single part or an entire build, with price suggestions based on a configurable target margin, buyer name tracking
- Dashboard — total profit/revenue/ROI, capital at risk vs recovered, profit-by-category breakdown, cumulative profit sparkline, average days-to-sell, per-bundle recovery tracking, recent sales feed
- History — full event timeline per part, CSV export of all parts/sales
- Settings — target margin %, dark/light theme toggle, clear-all-data
- All data synced live to PocketBase — same data on any device, survives server restarts

---

## 9. How to make changes going forward

1. Edit files locally in the `pc-trader` folder (confirm `App.jsx` lives in `pc-trader/src/`, not the root — this has bitten us once already)
2. `npm run build` locally to catch errors before deploying
3. `git add . && git commit -m "..." && git push`
4. Railway auto-redeploys the `pc-trader` app service on push to `main`
5. PocketBase is a separate service and does **not** need redeploying for app changes — only `setup-db.js` needs re-running if a new collection/field is introduced, and it's safe to re-run anytime since it skips collections that already exist
