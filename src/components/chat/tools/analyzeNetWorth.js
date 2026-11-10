export function analyzeNetWorth(toolInput, context) {
  const { localISO, dateKey, todayKey, parts, transactions, history, currentLive, firstSavedDate, resolveSnapshot } = context;
  const mode = String(toolInput.mode || 'growth').toLowerCase();
  const requestedDate = String(toolInput.date || '').trim();
  const startDate = String(toolInput.startDate || '').trim();
  const endDate = String(toolInput.endDate || '').trim();
  const months = Math.min(24, Math.max(1, Math.floor(Number(toolInput.months) || 6)));
  if (mode === 'point') {
    if (!requestedDate) return 'Missing date. Provide the requested date as YYYY-MM-DD.';
    const key = dateKey(requestedDate);
    if (!key) return `Invalid date: ${requestedDate}`;

    const snapshot = resolveSnapshot(key, true);
    if (!snapshot) {
      return JSON.stringify({
        mode,
        available: false,
        requestedDate: key,
        firstSnapshotDate: firstSavedDate,
        message: 'The historical position could not be reconstructed from the available records.'
      });
    }

    return JSON.stringify({
      mode,
      available: true,
      requestedDate: key,
      snapshot,
      exactSavedSnapshot: snapshot.source === 'saved_snapshot',
      reconstructionUsed: snapshot.source === 'reconstructed',
      firstSavedSnapshotDate: firstSavedDate,
      valuationNote: snapshot.source === 'reconstructed'
        ? 'Historical inventory market value uses each item\'s currently stored marketValue because prior market-value versions are not retained.'
        : null,
    });
  }

  if (mode === 'growth') {
    if (!startDate) return 'Missing startDate. Provide the start date as YYYY-MM-DD.';
    const startKey = dateKey(startDate);
    if (!startKey) return `Invalid startDate: ${startDate}`;

    const start = resolveSnapshot(startKey);
    if (!start) {
      return JSON.stringify({
        mode,
        available: false,
        requestedStartDate: startKey,
        firstSnapshotDate: firstSavedDate,
        message: 'The historical starting value could not be reconstructed from the available records.'
      });
    }

    let end = currentLive;
    if (endDate) {
      const endKey = dateKey(endDate);
      if (!endKey) return `Invalid endDate: ${endDate}`;
      end = resolveSnapshot(endKey, true);
      if (!end) {
        return JSON.stringify({ mode, available: false, requestedEndDate: endKey });
      }
    }

    const growth = end.netWorth - start.netWorth;
    const growthPct = start.netWorth !== 0 ? growth / Math.abs(start.netWorth) : null;

    return JSON.stringify({
      mode,
      available: true,
      requestedStartDate: startKey,
      startSnapshot: start,
      endSnapshot: end,
      growth,
      growthPct,
      exactStartDate: start.date === startKey,
      exactEndDate: !endDate || end.date === dateKey(endDate),
      reconstructionUsed: start.source === 'reconstructed' || end.source === 'reconstructed',
      valuationNote: start.source === 'reconstructed'
        ? 'The starting inventory market value is reconstructed using each item\'s current stored marketValue because historical market-value versions are not retained.'
        : null,
    });
  }

  if (mode === 'trend') {
    const now = new Date();
    const rows = [];
    for (let i = months - 1; i >= 0; i--) {
      const first = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const last = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const key = localISO(last);
      const resolved = key === todayKey ? currentLive : resolveSnapshot(key, true);
      rows.push({
        month: `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`,
        label: last.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' }),
        netWorth: resolved?.netWorth ?? null,
        snapshotDate: resolved?.date ?? null,
        source: resolved?.source ?? null,
      });
    }
    return JSON.stringify({
      mode,
      months,
      rows,
      firstSavedSnapshotDate: firstSavedDate,
      reconstructionAvailable: parts.length > 0 || transactions.length > 0,
    });
  }

  if (mode === 'change_analysis') {
    if (!startDate) return 'Missing startDate. Provide the beginning date as YYYY-MM-DD.';
    const startKey = dateKey(startDate);
    if (!startKey) return `Invalid startDate: ${startDate}`;

    const start = resolveSnapshot(startKey);
    if (!start) return JSON.stringify({ mode, available: false, requestedStartDate: startKey });

    const end = endDate
      ? resolveSnapshot(endDate, true)
      : currentLive;
    if (!end) return JSON.stringify({ mode, available: false, requestedEndDate: endDate || todayKey });

    const delta = {
      businessCash: end.businessCash - start.businessCash,
      inventoryMarketValue: end.inventoryMarketValue - start.inventoryMarketValue,
      outstandingReceivables: end.outstandingReceivables - start.outstandingReceivables,
      totalDebt: end.totalDebt - start.totalDebt,
      netWorth: end.netWorth - start.netWorth,
    };

    const contributors = [
      { name: 'Business cash', impact: delta.businessCash },
      { name: 'Inventory market value', impact: delta.inventoryMarketValue },
      { name: 'Outstanding receivables', impact: delta.outstandingReceivables },
      { name: 'Debt reduction', impact: -delta.totalDebt },
    ].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    return JSON.stringify({
      mode,
      available: true,
      startSnapshot: start,
      endSnapshot: end,
      delta,
      contributors,
      reconstructionUsed: start.source === 'reconstructed' || end.source === 'reconstructed',
    });
  }

  if (mode === 'best_month') {
    const currentMonth = new Date();
    const monthly = [];

    // Analyze up to 24 months, but start from the earliest month represented by the
    // available records when that is earlier than the rolling window. This restores the
    // useful pre-snapshot analysis the previous AI behaviour provided.
    const knownDays = [
      ...history.map(s => s.date),
      ...transactions.map(t => dateKey(t?.date)).filter(Boolean),
      ...parts.flatMap(p => Array.isArray(p?.history) ? p.history.map(h => dateKey(h?.date)).filter(Boolean) : []),
    ].sort();

    const earliest = knownDays[0] || localISO(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - (months - 1), 1));
    const earliestDate = new Date(`${earliest}T00:00:00`);
    const rollingStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - (months - 1), 1);
    const startMonth = earliestDate < rollingStart ? earliestDate : rollingStart;

    const cursor = new Date(startMonth.getFullYear(), startMonth.getMonth(), 1);
    while (cursor <= currentMonth) {
      const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const monthEndKey = cursor.getFullYear() === currentMonth.getFullYear() && cursor.getMonth() === currentMonth.getMonth()
        ? todayKey
        : localISO(last);
      const value = monthEndKey === todayKey
        ? currentLive
        : resolveSnapshot(monthEndKey, true);

      monthly.push({
        key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
        label: cursor.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' }),
        snapshot: value,
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    const increases = [];
    for (let i = 1; i < monthly.length; i++) {
      const previous = monthly[i - 1];
      const current = monthly[i];
      if (!previous.snapshot || !current.snapshot) continue;
      increases.push({
        month: current.key,
        label: current.label,
        previousMonth: previous.key,
        increase: current.snapshot.netWorth - previous.snapshot.netWorth,
        from: previous.snapshot.netWorth,
        to: current.snapshot.netWorth,
        previousSource: previous.snapshot.source,
        source: current.snapshot.source,
      });
    }

    increases.sort((a, b) => b.increase - a.increase);
    return JSON.stringify({
      mode,
      available: increases.length > 0,
      bestMonth: increases[0] || null,
      monthlyChanges: increases,
      firstSavedSnapshotDate: firstSavedDate,
      reconstructionUsed: increases.some(x => x.source === 'reconstructed' || x.previousSource === 'reconstructed'),
      valuationNote: 'Reconstructed historical months use each item\'s current stored marketValue because prior market-value versions are not retained.',
    });
  }

  return `Unknown net-worth analysis mode: ${mode}`;
}
