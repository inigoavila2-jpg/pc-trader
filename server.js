// server.js — Express server that bridges your React app to Supabase
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
require("dotenv").config({ path: ".env.development" });

const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 3001;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || "http://localhost:5173";
const STORAGE_BUCKET = process.env.SUPABASE_BUCKET || "photos";

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(cors({
  origin: [FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true,
}));

// In-memory storage for uploaded photos before forwarding to Supabase Storage.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

async function ensureStorageBucketExists() {
  if (!supabase || !STORAGE_BUCKET) return;
  const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, { public: true });
  if (error && !/already exists/i.test(error.message)) {
    console.error("Could not ensure Supabase storage bucket:", error.message);
  } else if (!error) {
    console.log(`Supabase storage bucket ready: ${STORAGE_BUCKET}`);
  }
}

console.log("Supabase config:", { SUPABASE_URL, STORAGE_BUCKET, hasServiceRoleKey: Boolean(SUPABASE_SERVICE_ROLE_KEY) });
if (!supabase) {
  console.warn("Supabase client not configured. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
} else {
  ensureStorageBucketExists()
    .then(() => console.log("Storage bucket check completed"))
    .catch((err) => console.error("Bucket initialization failed:", err.message || err));
}

const defaultState = {
  bundles: [],
  parts: [],
  builds: [],
  sales: [],
  settings: { targetMargin: 30 },
  customCategories: [],
  quickNotes: [],
  businessCash: 14500,
  personalCash: 0,
  expenses: [],
  transactions: [],
};

function normalizeDate(value) {
  if (!value) return null;
  // Previous version did `value.slice(0, 10)` on ANY string, assuming it was already an ISO
  // timestamp like "2026-08-02T00:00:00.000Z". But the frontend's today() sends locale strings
  // like "Aug 2, 2026" (11 chars when the day is a single digit) — slicing that to 10 chars
  // truncates the last digit of the YEAR itself, turning "Aug 2, 2026" into "Aug 2, 202". That
  // gets written into a Postgres DATE column, which reads "202" as a literal 3-digit year, and
  // whatever later formats it back out zero-pads it to "0202" — this was the entire bug.
  // Fix: always parse into a real Date first, then format from its actual fields. This works
  // correctly regardless of what string format the value arrives in.
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null; // don't silently write a garbage date — surface it as null instead
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toCurrencyNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function mapBundleRow(row) {
  return {
    id: row.id,
    name: row.name || "Untitled bundle",
    purchasePrice: toCurrencyNumber(row.purchase_price),
    totalMarket: toCurrencyNumber(row.total_market),
    photoUrl: row.photo_url || "",
    photoRecordId: row.photo_record_id || "",
    date: row.created_at || null,
  };
}

function mapPartRow(row) {
  return {
    id: row.id,
    bundleId: row.bundle_id || null,
    name: row.name || "Untitled part",
    category: row.category || "Other",
    allocatedCost: toCurrencyNumber(row.allocated_cost),
    marketValue: toCurrencyNumber(row.market_value),
    source: row.source || "",
    status: row.status || "available",
    soldTo: row.sold_to || "",
    notes: row.notes || "",
    photoUrl: row.photo_url || "",
    photoRecordId: row.photo_record_id || "",
    date: row.created_at || null,
    domain: row.domain || "pc_part",
    history: [],
  };
}

function mapBuildRow(row) {
  return {
    id: row.id,
    name: row.name || "Untitled build",
    photoUrl: row.photo_url || "",
    photoRecordId: row.photo_record_id || "",
    dissolved: Boolean(row.dissolved),
    sold: Boolean(row.sold),
    date: row.created_at || null,
    partIds: [],
  };
}

function mapSaleRow(row) {
  return {
    id: row.id,
    partId: row.part_id || null,
    buildId: row.build_id || null,
    name: row.name || "Sale",
    cost: toCurrencyNumber(row.cost),
    salePrice: toCurrencyNumber(row.sale_price),
    profit: toCurrencyNumber(row.profit),
    buyerName: row.buyer_name || "",
    writeOff: Boolean(row.write_off),
    reason: row.reason || "",
    returned: Boolean(row.returned),
    returnReason: row.return_reason || "",
    date: row.sale_date || null,
  };
}

function mapExpenseRow(row) {
  return {
    id: row.id,
    type: row.expense_type || "business",
    wallet: row.wallet || "business",
    amount: toCurrencyNumber(row.amount),
    description: row.description || "",
    date: row.expense_date || null,
  };
}

function mapTransactionRow(row) {
  return {
    id: row.id,
    type: row.type || "EXPENSE",
    amount: toCurrencyNumber(row.amount),
    description: row.description || "",
    wallet: row.wallet || "business",
    transferFrom: row.transfer_from || "",
    transferTo: row.transfer_to || "",
    date: row.transaction_date || null,
  };
}

function mapQuickNoteRow(row) {
  return { id: row.id, text: row.text || "", date: row.created_at || null };
}

function mapCategoryRow(row) {
  return { id: row.id, name: row.name || "", domain: row.domain || "pc_part" };
}

async function loadStateFromSupabase() {
  if (!supabase) return defaultState;

  const [settingsRes, categoriesRes, quickNotesRes, bundlesRes, buildsRes, partsRes, buildPartsRes, salesRes, expensesRes, transactionsRes, historyRes] = await Promise.all([
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("custom_categories").select("*").order("created_at", { ascending: true }),
    supabase.from("quick_notes").select("*").order("created_at", { ascending: true }),
    supabase.from("bundles").select("*").order("created_at", { ascending: true }),
    supabase.from("builds").select("*").order("created_at", { ascending: true }),
    supabase.from("parts").select("*").order("created_at", { ascending: true }),
    supabase.from("build_parts").select("*"),
    supabase.from("sales").select("*").order("sale_date", { ascending: true }),
    supabase.from("expenses").select("*").order("expense_date", { ascending: true }),
    supabase.from("transactions").select("*").order("transaction_date", { ascending: true }),
    supabase.from("part_history").select("*").order("event_date", { ascending: true }),
  ]);

  const state = {
    ...defaultState,
    bundles: (bundlesRes.data || []).map(mapBundleRow),
    builds: (buildsRes.data || []).map(mapBuildRow),
    parts: (partsRes.data || []).map(mapPartRow),
    sales: (salesRes.data || []).map(mapSaleRow),
    expenses: (expensesRes.data || []).map(mapExpenseRow),
    transactions: (transactionsRes.data || []).map(mapTransactionRow),
    customCategories: (categoriesRes.data || []).map(mapCategoryRow),
    quickNotes: (quickNotesRes.data || []).map(mapQuickNoteRow),
    settings: {
      targetMargin: settingsRes.data?.target_margin ?? defaultState.settings.targetMargin,
    },
    businessCash: settingsRes.data?.business_cash ?? defaultState.businessCash,
    personalCash: settingsRes.data?.personal_cash ?? defaultState.personalCash,
  };

  const historyByPart = {};
  for (const row of historyRes.data || []) {
    if (!historyByPart[row.part_id]) historyByPart[row.part_id] = [];
    historyByPart[row.part_id].push({ date: row.event_date || null, event: row.event || "" });
  }
  state.parts = state.parts.map((part) => ({ ...part, history: historyByPart[part.id] || [] }));

  const buildPartsMap = {};
  for (const row of buildPartsRes.data || []) {
    if (!buildPartsMap[row.build_id]) buildPartsMap[row.build_id] = [];
    buildPartsMap[row.build_id].push(row.part_id);
  }
  state.builds = state.builds.map((build) => ({ ...build, partIds: buildPartsMap[build.id] || [] }));

  return state;
}

async function saveStateToSupabase(state) {
  if (!supabase) return;

  const rows = state || defaultState;
  const bundlesRows = (rows.bundles || []).map((bundle) => ({
    id: bundle.id,
    name: bundle.name,
    purchase_price: toCurrencyNumber(bundle.purchasePrice),
    total_market: toCurrencyNumber(bundle.totalMarket),
    photo_url: bundle.photoUrl || null,
    photo_record_id: bundle.photoRecordId || null,
    created_at: normalizeDate(bundle.date || new Date()),
  }));

  const partsRows = (rows.parts || []).map((part) => ({
    id: part.id,
    bundle_id: part.bundleId || null,
    name: part.name,
    category: part.category || "Other",
    allocated_cost: toCurrencyNumber(part.allocatedCost),
    market_value: toCurrencyNumber(part.marketValue),
    source: part.source || null,
    status: part.status || "available",
    sold_to: part.soldTo || null,
    notes: part.notes || null,
    photo_url: part.photoUrl || null,
    photo_record_id: part.photoRecordId || null,
    created_at: normalizeDate(part.date || new Date()),
    domain: part.domain || "pc_part",
  }));

  const buildRows = (rows.builds || []).map((build) => ({
    id: build.id,
    name: build.name,
    photo_url: build.photoUrl || null,
    photo_record_id: build.photoRecordId || null,
    dissolved: Boolean(build.dissolved),
    sold: Boolean(build.sold),
    created_at: normalizeDate(build.date || new Date()),
  }));

  const buildPartsRows = [];
  for (const build of rows.builds || []) {
    for (const partId of build.partIds || []) {
      buildPartsRows.push({ build_id: build.id, part_id: partId });
    }
  }

  const salesRows = (rows.sales || []).map((sale) => ({
    id: sale.id,
    part_id: sale.partId || null,
    build_id: sale.buildId || null,
    name: sale.name,
    cost: toCurrencyNumber(sale.cost),
    sale_price: toCurrencyNumber(sale.salePrice),
    profit: toCurrencyNumber(sale.profit),
    buyer_name: sale.buyerName || null,
    write_off: Boolean(sale.writeOff),
    reason: sale.reason || null,
    returned: Boolean(sale.returned),
    return_reason: sale.returnReason || null,
    sale_date: normalizeDate(sale.date || new Date()),
  }));

  const expensesRows = (rows.expenses || []).map((expense) => ({
    id: expense.id,
    expense_type: expense.type || "business",
    wallet: expense.wallet || "business",
    amount: toCurrencyNumber(expense.amount),
    description: expense.description || null,
    expense_date: normalizeDate(expense.date || new Date()),
  }));

  const transactionsRows = (rows.transactions || []).map((transaction) => ({
    id: transaction.id,
    type: transaction.type || "EXPENSE",
    amount: toCurrencyNumber(transaction.amount),
    description: transaction.description || null,
    wallet: transaction.wallet || "business",
    transfer_from: transaction.transferFrom || null,
    transfer_to: transaction.transferTo || null,
    transaction_date: normalizeDate(transaction.date || new Date()),
  }));

  const quickNotesRows = (rows.quickNotes || []).map((note) => ({
    id: note.id,
    text: note.text || "",
    created_at: normalizeDate(note.date || new Date()),
  }));

  const categoriesRows = (rows.customCategories || []).map((category) => ({
    id: category.id,
    name: category.name,
    domain: category.domain || "pc_part",
    created_at: normalizeDate(new Date()),
  }));

  const settingsRows = {
    id: 1,
    target_margin: toCurrencyNumber(rows.settings?.targetMargin ?? defaultState.settings.targetMargin),
    business_cash: toCurrencyNumber(rows.businessCash ?? defaultState.businessCash),
    personal_cash: toCurrencyNumber(rows.personalCash ?? defaultState.personalCash),
  };

  const partHistoryRows = [];
  for (const part of rows.parts || []) {
    for (const item of part.history || []) {
      partHistoryRows.push({
        part_id: part.id,
        event: item.event || "",
        event_date: normalizeDate(item.date || new Date()),
      });
    }
  }

  await supabase.from("bundles").delete().not("id", "is", null);
  await supabase.from("parts").delete().not("id", "is", null);
  await supabase.from("builds").delete().not("id", "is", null);
  await supabase.from("build_parts").delete().not("build_id", "is", null);
  await supabase.from("sales").delete().not("id", "is", null);
  await supabase.from("expenses").delete().not("id", "is", null);
  await supabase.from("transactions").delete().not("id", "is", null);
  await supabase.from("quick_notes").delete().not("id", "is", null);
  await supabase.from("custom_categories").delete().not("id", "is", null);
  await supabase.from("part_history").delete().not("id", "is", null);
  await supabase.from("app_settings").upsert(settingsRows, { onConflict: "id" });

  if (bundlesRows.length) await supabase.from("bundles").insert(bundlesRows);
  if (partsRows.length) await supabase.from("parts").insert(partsRows);
  if (buildRows.length) await supabase.from("builds").insert(buildRows);
  if (buildPartsRows.length) await supabase.from("build_parts").insert(buildPartsRows);
  if (salesRows.length) await supabase.from("sales").insert(salesRows);
  if (expensesRows.length) await supabase.from("expenses").insert(expensesRows);
  if (transactionsRows.length) await supabase.from("transactions").insert(transactionsRows);
  if (quickNotesRows.length) await supabase.from("quick_notes").insert(quickNotesRows);
  if (categoriesRows.length) await supabase.from("custom_categories").insert(categoriesRows);
  if (partHistoryRows.length) await supabase.from("part_history").insert(partHistoryRows);
}

// ---- API routes ----
app.get("/data", async (req, res) => {
  try {
    const state = await loadStateFromSupabase();
    res.json(state);
  } catch (err) {
    console.error("GET /data error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/data", async (req, res) => {
  try {
    if (!supabase) {
      throw new Error("Supabase client not configured");
    }
    console.log("POST /data payload size:", JSON.stringify(req.body).length);
    await saveStateToSupabase(req.body);
    console.log("POST /data saved successfully");
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /data error:", err.message, err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => res.json({ ok: true }));

// ---- Photo upload ----
// Accepts a single image (multipart/form-data, field name "photo"), forwards it to Supabase Storage.
app.post("/photo", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });

    console.log("/photo upload requested", { fileName: req.file.originalname, fileSize: req.file.size, bucket: STORAGE_BUCKET });
    await ensureStorageBucketExists();

    const safeName = (req.file.originalname || "photo.jpg").replace(/[^a-zA-Z0-9._-]/g, "-");
    const fileName = `${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype || "application/octet-stream",
      upsert: true,
    });

    if (error) {
      console.error("Supabase upload returned error:", error.message, error);
      throw new Error(error.message);
    }

    const { data: publicData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fileName);
    res.json({ url: publicData.publicUrl, recordId: fileName });
  } catch (err) {
    console.error("Photo upload error:", err.message, err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Photo delete ----
app.delete("/photo/:recordId", async (req, res) => {
  try {
    if (!supabase) return res.status(500).json({ error: "Supabase client not configured" });
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([req.params.recordId]);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    console.error("Photo delete error:", err.message);
    res.status(200).json({ ok: false, error: err.message });
  }
});

// ---- Serve the built React app ----
const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));
app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
