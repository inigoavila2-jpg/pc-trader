const { supabase } = require("./config");
const { defaultState, normalizeDate, toCurrencyNumber, mapBundleRow, mapPartRow, mapBuildRow, mapSaleRow, mapExpenseRow, mapTransactionRow, mapQuickNoteRow, mapCategoryRow } = require("./stateMappers");

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

module.exports = { loadStateFromSupabase };
