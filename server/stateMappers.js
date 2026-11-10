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

module.exports = { defaultState, normalizeDate, toCurrencyNumber, mapBundleRow, mapPartRow, mapBuildRow, mapSaleRow, mapExpenseRow, mapTransactionRow, mapQuickNoteRow, mapCategoryRow };
