export async function createNetWorthContext(liveState) {
  let dbState = liveState;
  try {
    const dbRes = await fetch('/data', { cache: 'no-store' });
    if (dbRes.ok) {
      const fresh = await dbRes.json();
      if (fresh && Object.keys(fresh).length) {
        dbState = { ...fresh, ...liveState };
        dbState.netWorthSnapshots = [
          ...(Array.isArray(fresh.netWorthSnapshots) ? fresh.netWorthSnapshots : []),
          ...(Array.isArray(liveState.netWorthSnapshots) ? liveState.netWorthSnapshots : []),
        ];
      }
    }
  } catch (err) {
    console.warn('Live database read failed; using current in-memory state:', err);
  }

  const localISO = (d = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const dateKey = (value) => {
    if (!value) return '';
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return '';
    return localISO(d);
  };

  const todayKey = localISO();
  const parts = Array.isArray(dbState.parts) ? dbState.parts : [];
  const sales = Array.isArray(dbState.sales) ? dbState.sales : [];
  const transactions = Array.isArray(dbState.transactions) ? dbState.transactions : [];
  const savedSnapshots = Array.isArray(dbState.netWorthSnapshots) ? dbState.netWorthSnapshots : [];

  const normaliseSnapshot = (s) => ({
    ...s,
    date: dateKey(s?.date),
    netWorth: Number(s?.netWorth || 0),
    businessCash: Number(s?.businessCash || 0),
    inventoryCost: Number(s?.inventoryCost || 0),
    inventoryMarketValue: Number(s?.inventoryMarketValue || 0),
    outstandingReceivables: Number(s?.outstandingReceivables || 0),
    totalDebt: Number(s?.totalDebt || 0),
    activeInventoryCount: Number(s?.activeInventoryCount || 0),
  });

  const byDate = new Map();
  for (const raw of savedSnapshots) {
    const s = normaliseSnapshot(raw);
    if (!s.date || !Number.isFinite(s.netWorth)) continue;
    const old = byDate.get(s.date);
    if (!old || String(s.capturedAt || '') >= String(old.capturedAt || '')) byDate.set(s.date, s);
  }
  const history = [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const currentLive = (() => {
    const active = parts.filter(p => p.status === 'available' || p.status === 'in_build');
    const inventoryMarketValue = active.reduce((sum, p) => {
      const market = Number(p?.marketValue || 0);
      const cost = Number(p?.allocatedCost || 0);
      return sum + (market > 0 ? market : cost);
    }, 0);
    const inventoryCost = active.reduce((sum, p) => sum + Number(p?.allocatedCost || 0), 0);
    const businessCash = Number(dbState.businessCash || 0);
    const outstandingReceivables = Number(dbState.outstandingReceivables || 0);
    const totalDebt = Number(dbState.totalDebt || 0);
    return {
      id: `nw_live_${todayKey}`,
      date: todayKey,
      capturedAt: new Date().toISOString(),
      source: 'live_current_state',
      businessCash,
      inventoryCost,
      inventoryMarketValue,
      outstandingReceivables,
      totalDebt,
      netWorth: businessCash + inventoryMarketValue + outstandingReceivables - totalDebt,
      activeInventoryCount: active.length,
    };
  })();

  const transactionCashDelta = (txn) => {
    const amount = Number(txn?.amount || 0);
    const wallet = txn?.wallet || 'business';
    switch (txn?.type) {
      case 'PURCHASE': return wallet === 'business' ? -amount : 0;
      case 'SALE': return wallet === 'business' ? amount : 0;
      case 'EXPENSE': return wallet === 'business' ? -amount : 0;
      case 'INCOME': return wallet === 'business' ? amount : 0;
      case 'TRANSFER':
        if (txn?.from === 'business') return -amount;
        if (txn?.to === 'business') return amount;
        return 0;
      case 'REVERSAL': return wallet === 'business' ? -amount : 0;
      default: return 0;
    }
  };

  const reconstructSnapshot = (targetDate) => {
    const key = dateKey(targetDate);
    if (!key) return null;

    // Reverse all business-cash movements after the requested day.
    // Transactions on the requested day remain included in the historical balance,
    // so the reconstructed snapshot represents the end of that calendar day.
    const cashAfterTarget = transactions
      .filter(txn => dateKey(txn?.date) > key)
      .reduce((sum, txn) => sum + transactionCashDelta(txn), 0);
    const businessCash = Number(dbState.businessCash || 0) - cashAfterTarget;

    const activeAtDate = [];
    for (const part of parts) {
      const historyEntries = Array.isArray(part?.history)
        ? part.history
          .map(h => ({ ...h, day: dateKey(h?.date) }))
          .filter(h => h.day)
          .sort((a, b) => a.day.localeCompare(b.day))
        : [];

      const created = historyEntries[0]?.day;
      if (!created || created > key) continue;

      let present = true;
      for (const h of historyEntries) {
        if (h.day > key) break;
        const event = String(h.event || '').toLowerCase();

        if (
          event.includes('sold to ') ||
          event.includes('sold in build') ||
          event.includes('marked defective/write-off') ||
          event.includes('marked defective') ||
          event.includes('write-off')
        ) {
          present = false;
        }

        if (
          event.includes('sale undone') &&
          (event.includes('returned to inventory') || event.includes('reactivated'))
        ) {
          present = true;
        }

        if (
          event.includes('sale record deleted') &&
          (event.includes('returned to inventory') || event.includes('reactivated'))
        ) {
          present = true;
        }
      }

      if (present) activeAtDate.push(part);
    }

    const inventoryMarketValue = activeAtDate.reduce((sum, p) => {
      const market = Number(p?.marketValue || 0);
      const cost = Number(p?.allocatedCost || 0);
      return sum + (market > 0 ? market : cost);
    }, 0);
    const inventoryCost = activeAtDate.reduce(
      (sum, p) => sum + Number(p?.allocatedCost || 0),
      0
    );

    // Receivables and debt currently have no dated history in the state model, so the
    // best defensible reconstruction is their currently stored values. They are exposed
    // separately so the model does not mistake them for transaction-derived history.
    const outstandingReceivables = Number(dbState.outstandingReceivables || 0);
    const totalDebt = Number(dbState.totalDebt || 0);
    const netWorth =
      businessCash +
      inventoryMarketValue +
      outstandingReceivables -
      totalDebt;

    return {
      id: `nw_reconstructed_${key}`,
      date: key,
      capturedAt: null,
      source: 'reconstructed',
      businessCash,
      inventoryCost,
      inventoryMarketValue,
      outstandingReceivables,
      totalDebt,
      netWorth,
      activeInventoryCount: activeAtDate.length,
      exactHistoricalMarketValues: false,
    };
  };

  const firstSavedDate = history[0]?.date || null;

  // A saved snapshot is always preferred. If it is missing, reconstruct the exact day
  // from the transaction ledger + item history instead of refusing the question.
  const resolveSnapshot = (targetDate, allowFutureCurrent = false) => {
    const key = dateKey(targetDate);
    if (!key) return null;

    if (allowFutureCurrent && key >= todayKey) return currentLive;

    const exact = history.find(s => s.date === key);
    if (exact) return { ...exact, source: 'saved_snapshot' };

    return reconstructSnapshot(key);
  };


  return { localISO, dateKey, todayKey, parts, transactions, history, currentLive, firstSavedDate, resolveSnapshot };
}
