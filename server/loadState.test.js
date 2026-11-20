const assert = require("node:assert/strict");
const test = require("node:test");
const { restoreLegacyTransactions } = require("./loadState");

const legacyData = () => ({
  sales: [
    { id: "sale-1", name: "GPU", salePrice: 2500, buyerName: "Kai", date: "2026-06-01", paymentAccount: "cash" },
    { id: "sale-returned", name: "Returned part", salePrice: 900, date: "2026-06-02", returned: true },
  ],
  expenses: [
    { id: "expense-1", type: "business", wallet: "business", amount: 100, description: "Shipping", account: "bank", date: "2026-06-03" },
    { id: "expense-personal", type: "personal_draw", wallet: "personal", amount: 500, date: "2026-06-03" },
  ],
  bundles: [{ id: "bundle-1", name: "Office lot", purchasePrice: 1200, date: "2026-06-04" }],
  parts: [
    { id: "part-1", name: "Keyboard", allocatedCost: 300, date: "2026-06-05" },
    { id: "part-2", name: "Bundled GPU", allocatedCost: 500, bundleId: "bundle-1", date: "2026-06-04" },
  ],
});

test("reconstructs business ledger activity missing from transactions", () => {
  const { sales, expenses, bundles, parts } = legacyData();
  const restored = restoreLegacyTransactions([], sales, expenses, bundles, parts);

  assert.deepEqual(restored.map((transaction) => transaction.type), [
    "SALE",
    "EXPENSE",
    "PURCHASE",
    "PURCHASE",
  ]);
  assert.equal(restored[0].account, "cash");
  assert.equal(restored[3].id, "legacy-part-part-1");
});

test("does not duplicate saved transactions or part purchases from their date", () => {
  const { sales, expenses, bundles, parts } = legacyData();
  const saved = [
    { type: "SALE", amount: 2500, description: "Sold GPU to Kai", wallet: "business", account: "cash", date: "2026-06-01" },
    { type: "EXPENSE", amount: 100, description: "Shipping", wallet: "business", account: "bank", date: "2026-06-03" },
    { type: "PURCHASE", amount: 1200, description: "Bought bundle: Office lot", wallet: "business", account: "cash", date: "2026-06-04" },
    { type: "PURCHASE", amount: 300, description: "Bought Keyboard", wallet: "business", account: "cash", date: "2026-06-05" },
  ];

  assert.equal(restoreLegacyTransactions(saved, sales, expenses, bundles, parts).length, saved.length);
});
