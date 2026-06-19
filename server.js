// server.js — Express server that bridges your React app to PocketBase
const express = require("express");
const path = require("path");

const PB_URL = process.env.PB_URL;
const PB_EMAIL = process.env.PB_ADMIN_EMAIL;
const PB_PASS = process.env.PB_ADMIN_PASS;
const PORT = process.env.PORT || 3001;

if (!PB_URL || !PB_EMAIL || !PB_PASS) {
  console.error("Missing required env vars: PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASS");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "5mb" }));

// ---- PocketBase auth (cached + auto-refreshed) ----
// PocketBase v0.23+ uses the _superusers auth collection, not the old /api/admins
let pbToken = null;
let pbTokenExpiry = 0;

async function getPbToken() {
  if (pbToken && Date.now() < pbTokenExpiry) return pbToken;

  const res = await fetch(`${PB_URL}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: PB_EMAIL, password: PB_PASS }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PocketBase auth failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  pbToken = json.token;
  // PocketBase tokens last a while; refresh a bit early to be safe (50 minutes)
  pbTokenExpiry = Date.now() + 50 * 60 * 1000;
  return pbToken;
}

async function pbFetch(urlPath, options = {}) {
  const token = await getPbToken();
  const res = await fetch(`${PB_URL}${urlPath}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  return res;
}

// ---- Find or create the single store record ----
// We keep ONE record in the "store" collection holding the entire app state as JSON.
let storeRecordId = null;

async function getStoreRecordId() {
  if (storeRecordId) return storeRecordId;

  const res = await pbFetch(`/api/collections/store/records?perPage=1`);
  if (!res.ok) throw new Error(`Failed to list store records: ${res.status}`);
  const json = await res.json();

  if (json.items && json.items.length > 0) {
    storeRecordId = json.items[0].id;
    return storeRecordId;
  }

  // No record yet — create the first one with empty default data
  const defaultData = { bundles: [], parts: [], builds: [], sales: [], settings: { targetMargin: 30 } };
  const createRes = await pbFetch(`/api/collections/store/records`, {
    method: "POST",
    body: JSON.stringify({ data: defaultData }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Failed to create store record (${createRes.status}): ${text}`);
  }
  const created = await createRes.json();
  storeRecordId = created.id;
  return storeRecordId;
}

// ---- API routes ----
app.get("/data", async (req, res) => {
  try {
    const id = await getStoreRecordId();
    const r = await pbFetch(`/api/collections/store/records/${id}`);
    if (!r.ok) throw new Error(`PocketBase GET failed: ${r.status}`);
    const record = await r.json();
    res.json(record.data);
  } catch (err) {
    console.error("GET /data error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/data", async (req, res) => {
  try {
    const id = await getStoreRecordId();
    const r = await pbFetch(`/api/collections/store/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ data: req.body }),
    });
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`PocketBase PATCH failed (${r.status}): ${text}`);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /data error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

// ---- Serve the built React app ----
const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));
app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
