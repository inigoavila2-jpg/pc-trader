const { supabase } = require("./config");
const { defaultState, normalizeDate, toCurrencyNumber, mapBundleRow, mapPartRow, mapBuildRow, mapSaleRow, mapExpenseRow, mapTransactionRow, mapQuickNoteRow, mapCategoryRow } = require("./stateMappers");

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

module.exports = { saveStateToSupabase };
