const { supabase } = require("./config");
const { defaultState, normalizeDate, toCurrencyNumber, mapBundleRow, mapPartRow, mapBuildRow, mapSaleRow, mapExpenseRow, mapTransactionRow, mapQuickNoteRow, mapCategoryRow } = require("./stateMappers");

function restoreLegacyTransactions(transactions, sales, expenses, bundles, parts) {
  const existing = transactions || [];
  const restored = [...existing];
  const matched = new Set();
  const existingPurchaseDates = new Set(
    existing
      .filter((transaction) => transaction.type === "PURCHASE" && transaction.wallet !== "personal")
      .map((transaction) => transaction.date)
      .filter(Boolean)
  );

  const addIfMissing = (candidate, compareAccount = true) => {
    const index = existing.findIndex((transaction, i) =>
      !matched.has(i) &&
      transaction.type === candidate.type &&
      transaction.date === candidate.date &&
      Number(transaction.amount || 0) === candidate.amount &&
      (transaction.description || "") === candidate.description &&
      (transaction.wallet || "business") === candidate.wallet &&
      (!compareAccount || (transaction.account || "bank") === candidate.account)
    );

    if (index >= 0) {
      matched.add(index);
      return;
    }

    restored.push(candidate);
  };

  // Older records predate the unified ledger, so reconstruct their cash activity from source tables.
  for (const sale of sales || []) {
    const amount = Number(sale.salePrice || 0);
    if (sale.returned || sale.writeOff || amount <= 0 || !sale.date) continue;

    addIfMissing({
      id: `legacy-sale-${sale.id}`,
      type: "SALE",
      amount,
      description: `Sold ${sale.name}${sale.buyerName ? ` to ${sale.buyerName}` : ""}`,
      wallet: "business",
      account: sale.paymentAccount || sale.account || "bank",
      date: sale.date,
    });
  }

  for (const expense of expenses || []) {
    const amount = Number(expense.amount || 0);
    if (expense.type !== "business" || expense.wallet !== "business" || amount <= 0 || !expense.date) continue;

    addIfMissing({
      id: `legacy-expense-${expense.id}`,
      type: "EXPENSE",
      amount,
      description: expense.description || "",
      wallet: "business",
      account: expense.account || "bank",
      date: expense.date,
    });
  }

  for (const bundle of bundles || []) {
    const amount = Number(bundle.purchasePrice || 0);
    if (amount <= 0 || !bundle.date) continue;

    addIfMissing({
      id: `legacy-bundle-${bundle.id}`,
      type: "PURCHASE",
      amount,
      description: `Bought bundle: ${bundle.name || "Untitled bundle"}`,
      wallet: "business",
      account: "bank",
      date: bundle.date,
    }, false);
  }

  for (const part of parts || []) {
    const amount = Number(part.allocatedCost || 0);
    if (
      part.bundleId ||
      String(part.source || "").startsWith("Untracked (bundle deleted)") ||
      amount <= 0 ||
      !part.date ||
      existingPurchaseDates.has(part.date)
    ) continue;

    addIfMissing({
      id: `legacy-part-${part.id}`,
      type: "PURCHASE",
      amount,
      description: `Bought ${part.name}`,
      wallet: "business",
      account: "bank",
      date: part.date,
    }, false);
  }

  return restored;
}

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
    transactions: restoreLegacyTransactions(
      (transactionsRes.data || []).map(mapTransactionRow),
      (salesRes.data || []).map(mapSaleRow),
      (expensesRes.data || []).map(mapExpenseRow),
      (bundlesRes.data || []).map(mapBundleRow),
      (partsRes.data || []).map(mapPartRow)
    ),
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

async function loadThemeFromSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("app_settings")
    .select("theme_mode,active_theme_slot,theme_palette_slots")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase theme read failed: ${error.message}`);
  }

  return {
    themeMode: data?.theme_mode === "light" ? "light" : "dark",
    activeThemeSlot: Number(data?.active_theme_slot || defaultState.activeThemeSlot),
    themePaletteSlots: data?.theme_palette_slots || { 2: null, 3: null, 4: null, 5: null },
  };
}

// ---------------- SAVE APPLICATION DATA ----------------

module.exports = { loadStateFromSupabase, loadThemeFromSupabase, restoreLegacyTransactions };
