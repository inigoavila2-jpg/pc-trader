// server.js — Express server that bridges PC Trader to Supabase
require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
require("dotenv").config({ path: ".env.development" });

const express = require("express");
const multer = require("multer");
const path = require("path");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");

const PORT = process.env.PORT || 3001;
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  process.env.CORS_ORIGIN ||
  "http://localhost:5173";

const STORAGE_BUCKET = process.env.SUPABASE_BUCKET || "photos";

const app = express();

app.use(express.json({ limit: "5mb" }));

app.use(cors({
  origin: [
    FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ],
  credentials: true,
}));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
});

const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

async function ensureStorageBucketExists() {
  if (!supabase || !STORAGE_BUCKET) return;

  const { error } = await supabase.storage.createBucket(
    STORAGE_BUCKET,
    { public: true }
  );

  if (error && !/already exists/i.test(error.message)) {
    console.error("Storage bucket error:", error.message);
  }
}

console.log("Supabase configuration:", {
  configured: Boolean(supabase),
  bucket: STORAGE_BUCKET,
});

if (!supabase) {
  console.warn(
    "Supabase is not configured. Check your Render environment variables."
  );
} else {
  ensureStorageBucketExists().catch((err) => {
    console.error("Storage initialization failed:", err.message);
  });
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
  cashOnHand: 0,
  personalCash: 0,

  themeMode: "dark",
  activeThemeSlot: 1,
  themePaletteSlots: {
    2: null,
    3: null,
    4: null,
    5: null,
  },

  outstandingReceivables: 0,
  totalDebt: 0,
  netWorthSnapshots: [],
  hiddenCategories: [],

  expenses: [],
  transactions: [],
};

function normalizeDate(value) {
  if (!value) return null;

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;

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
    buildPartsSnapshot: row.build_parts_snapshot || undefined,
    paymentAccount: row.payment_account || row.account || "bank",
  };
}

function mapExpenseRow(row) {
  return {
    id: row.id,
    type: row.expense_type || "business",
    wallet: row.wallet || "business",
    account: row.account || (row.wallet === "personal" ? null : "bank"),
    amount: toCurrencyNumber(row.amount),
    description: row.description || "",
    date: row.expense_date || null,
  };
}

function mapTransactionRow(row) {
  const from = row.transfer_from || "";
  const to = row.transfer_to || "";

  return {
    id: row.id,
    type: row.type || "EXPENSE",
    amount: toCurrencyNumber(row.amount),
    description: row.description || "",
    wallet: row.wallet || "business",
    account: row.account || (row.wallet === "personal" ? null : "bank"),
    from,
    to,
    transferFrom: from,
    transferTo: to,
    date: row.transaction_date || null,
  };
}

function mapQuickNoteRow(row) {
  return {
    id: row.id,
    text: row.text || "",
    date: row.created_at || null,
  };
}

function mapCategoryRow(row) {
  return {
    id: row.id,
    name: row.name || "",
    domain: row.domain || "pc_part",
  };
}

// ---------------- LOAD APPLICATION DATA ----------------

async function loadStateFromSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const [
    settingsRes,
    categoriesRes,
    quickNotesRes,
    bundlesRes,
    buildsRes,
    partsRes,
    buildPartsRes,
    salesRes,
    expensesRes,
    transactionsRes,
    historyRes,
  ] = await Promise.all([
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("custom_categories").select("*").order("created_at"),
    supabase.from("quick_notes").select("*").order("created_at"),
    supabase.from("bundles").select("*").order("created_at"),
    supabase.from("builds").select("*").order("created_at"),
    supabase.from("parts").select("*").order("created_at"),
    supabase.from("build_parts").select("*"),
    supabase.from("sales").select("*").order("sale_date"),
    supabase.from("expenses").select("*").order("expense_date"),
    supabase.from("transactions").select("*").order("transaction_date"),
    supabase.from("part_history").select("*").order("event_date"),
  ]);

  const requiredResults = [
    settingsRes,
    categoriesRes,
    quickNotesRes,
    bundlesRes,
    buildsRes,
    partsRes,
    buildPartsRes,
    salesRes,
    expensesRes,
    transactionsRes,
    historyRes,
  ];

  for (const result of requiredResults) {
    if (result.error) {
      throw new Error(`Supabase read failed: ${result.error.message}`);
    }
  }

  const settings = settingsRes.data || {};

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
      targetMargin:
        settings.target_margin ??
        defaultState.settings.targetMargin,
    },

    businessCash:
      settings.business_cash ?? defaultState.businessCash,

    cashOnHand:
      settings.cash_on_hand ?? defaultState.cashOnHand,

    personalCash:
      settings.personal_cash ?? defaultState.personalCash,

    themeMode:
      settings.theme_mode === "light" ? "light" : "dark",

    activeThemeSlot: Math.min(
      5,
      Math.max(
        1,
        Math.floor(
          Number(settings.active_theme_slot) ||
          defaultState.activeThemeSlot
        )
      )
    ),

    themePaletteSlots: {
      2: null,
      3: null,
      4: null,
      5: null,
      ...(settings.theme_palette_slots || {}),
    },

    outstandingReceivables:
      toCurrencyNumber(settings.outstanding_receivables),

    totalDebt:
      toCurrencyNumber(settings.total_debt),

    netWorthSnapshots:
      settings.net_worth_snapshots || [],

    hiddenCategories:
      settings.hidden_categories || [],
  };

  const historyByPart = {};

  for (const row of historyRes.data || []) {
    if (!historyByPart[row.part_id]) {
      historyByPart[row.part_id] = [];
    }

    historyByPart[row.part_id].push({
      date: row.event_date || null,
      event: row.event || "",
    });
  }

  state.parts = state.parts.map((part) => ({
    ...part,
    history: historyByPart[part.id] || [],
  }));

  const buildPartsMap = {};

  for (const row of buildPartsRes.data || []) {
    if (!buildPartsMap[row.build_id]) {
      buildPartsMap[row.build_id] = [];
    }

    buildPartsMap[row.build_id].push(row.part_id);
  }

  state.builds = state.builds.map((build) => ({
    ...build,
    partIds: buildPartsMap[build.id] || [],
  }));

  return state;
}

// ---------------- SAVE APPLICATION DATA ----------------

async function saveStateToSupabase(state) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const rows = state || defaultState;

  const settingsRows = {
    id: 1,
    target_margin: toCurrencyNumber(
      rows.settings?.targetMargin ?? defaultState.settings.targetMargin
    ),

    // Both money balances are persisted separately.
    business_cash: toCurrencyNumber(
      rows.businessCash ?? defaultState.businessCash
    ),
    cash_on_hand: toCurrencyNumber(
      rows.cashOnHand ?? defaultState.cashOnHand
    ),
    personal_cash: toCurrencyNumber(
      rows.personalCash ?? defaultState.personalCash
    ),

    // Shared theme settings used by PC and phone.
    theme_mode: rows.themeMode === "light" ? "light" : "dark",
    active_theme_slot: Math.min(
      5,
      Math.max(1, Math.floor(Number(rows.activeThemeSlot) || 1))
    ),
    theme_palette_slots: {
      2: null,
      3: null,
      4: null,
      5: null,
      ...(rows.themePaletteSlots || {}),
    },

    outstanding_receivables: toCurrencyNumber(
      rows.outstandingReceivables
    ),
    total_debt: toCurrencyNumber(rows.totalDebt),
    net_worth_snapshots: rows.netWorthSnapshots || [],
    hidden_categories: rows.hiddenCategories || [],
  };

  // Save account balances and theme configuration first.
  const { error: settingsError } = await supabase
    .from("app_settings")
    .upsert(settingsRows, { onConflict: "id" });

  if (settingsError) {
    throw new Error(
      `Failed to save app settings, balances, or theme: ${settingsError.message}`
    );
  }

  const check = async (query, label) => {
    const { error } = await query;

    if (error) {
      throw new Error(`${label}: ${error.message}`);
    }
  };

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
      buildPartsRows.push({
        build_id: build.id,
        part_id: partId,
      });
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
    build_parts_snapshot:
      sale.buildPartsSnapshot?.length
        ? sale.buildPartsSnapshot
        : null,
    payment_account: sale.paymentAccount || sale.account || "bank",
  }));

  const expensesRows = (rows.expenses || []).map((expense) => ({
    id: expense.id,
    expense_type: expense.type || "business",
    wallet: expense.wallet || "business",
    account:
      expense.account ||
      (expense.wallet === "personal" ? null : "bank"),
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
    account:
      transaction.account ||
      (transaction.wallet === "personal" ? null : "bank"),
    transfer_from:
      transaction.from || transaction.transferFrom || null,
    transfer_to:
      transaction.to || transaction.transferTo || null,
    transaction_date: normalizeDate(
      transaction.date || new Date()
    ),
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

  // Only after settings have been saved do we rewrite the related tables.
  // Every operation checks Supabase errors rather than reporting false success.
  await check(
    supabase.from("bundles").delete().not("id", "is", null),
    "Delete bundles failed"
  );
  await check(
    supabase.from("parts").delete().not("id", "is", null),
    "Delete parts failed"
  );
  await check(
    supabase.from("builds").delete().not("id", "is", null),
    "Delete builds failed"
  );
  await check(
    supabase.from("build_parts").delete().not("build_id", "is", null),
    "Delete build parts failed"
  );
  await check(
    supabase.from("sales").delete().not("id", "is", null),
    "Delete sales failed"
  );
  await check(
    supabase.from("expenses").delete().not("id", "is", null),
    "Delete expenses failed"
  );
  await check(
    supabase.from("transactions").delete().not("id", "is", null),
    "Delete transactions failed"
  );
  await check(
    supabase.from("quick_notes").delete().not("id", "is", null),
    "Delete quick notes failed"
  );
  await check(
    supabase.from("custom_categories").delete().not("id", "is", null),
    "Delete categories failed"
  );
  await check(
    supabase.from("part_history").delete().not("id", "is", null),
    "Delete part history failed"
  );

  if (bundlesRows.length) {
    await check(supabase.from("bundles").insert(bundlesRows), "Save bundles failed");
  }
  if (partsRows.length) {
    await check(supabase.from("parts").insert(partsRows), "Save parts failed");
  }
  if (buildRows.length) {
    await check(supabase.from("builds").insert(buildRows), "Save builds failed");
  }
  if (buildPartsRows.length) {
    await check(supabase.from("build_parts").insert(buildPartsRows), "Save build parts failed");
  }
  if (salesRows.length) {
    await check(supabase.from("sales").insert(salesRows), "Save sales failed");
  }
  if (expensesRows.length) {
    await check(supabase.from("expenses").insert(expensesRows), "Save expenses failed");
  }
  if (transactionsRows.length) {
    await check(supabase.from("transactions").insert(transactionsRows), "Save transactions failed");
  }
  if (quickNotesRows.length) {
    await check(supabase.from("quick_notes").insert(quickNotesRows), "Save notes failed");
  }
  if (categoriesRows.length) {
    await check(supabase.from("custom_categories").insert(categoriesRows), "Save categories failed");
  }
  if (partHistoryRows.length) {
    await check(supabase.from("part_history").insert(partHistoryRows), "Save part history failed");
  }
}

// ---------------- API ROUTES ----------------

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
      throw new Error("Supabase client not configured.");
    }

    await saveStateToSupabase(req.body);

    console.log("POST /data saved successfully");
    res.json({ ok: true });
  } catch (err) {
    console.error("POST /data failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// ---------------- PHOTO UPLOAD ----------------

app.post("/photo", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    if (!supabase) {
      return res.status(500).json({ error: "Supabase is not configured" });
    }

    await ensureStorageBucketExists();

    const safeName = (req.file.originalname || "photo.jpg")
      .replace(/[^a-zA-Z0-9._-]/g, "-");

    const fileName = `${Date.now()}-${safeName}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype || "application/octet-stream",
        upsert: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    res.json({
      url: data.publicUrl,
      recordId: fileName,
    });
  } catch (err) {
    console.error("Photo upload failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/photo/:recordId", async (req, res) => {
  try {
    if (!supabase) {
      return res.status(500).json({ error: "Supabase is not configured" });
    }

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([req.params.recordId]);

    if (error) {
      throw new Error(error.message);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("Photo deletion failed:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------- SERVE THE REACT APP ----------------

const distDir = path.join(__dirname, "dist");

app.use(express.static(distDir));

app.get("*", (req, res) => {
  res.sendFile(path.join(distDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`PC Trader server running on port ${PORT}`);
});
