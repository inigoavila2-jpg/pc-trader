


export async function handleBusinessTool(toolName, toolInput, ctx) {
  const { liveState, dispatch, setTab, setFormData, toast, pendingImageRef, uploadImageToPocketBase, messages } = ctx;
  switch (toolName) {
          case 'query_business_database': {
            const scope = toolInput.scope || 'summary';
            const query = String(toolInput.query || '').trim().toLowerCase();
            const limit = Math.min(30, Math.max(1, Math.floor(Number(toolInput.limit) || 25)));

            let dbState = liveState;
            try {
              const dbRes = await fetch('/data', { cache: 'no-store' });
              if (dbRes.ok) {
                const fresh = await dbRes.json();
                if (fresh && Object.keys(fresh).length) dbState = { ...liveState, ...fresh };
              }
            } catch (err) {
              console.warn('Live database read failed; using current in-memory state:', err);
            }

            const textOf = (...values) => values.filter(v => v !== undefined && v !== null).map(v => String(v)).join(' ').toLowerCase();
            const matches = (record, extra='') => !query || textOf(extra, record?.name, record?.description, record?.buyerName, record?.source, record?.notes, record?.category, record?.soldTo, record?.reason, record?.date, record?.type).includes(query);
            const cleanPart = p => ({
              id: p.id, name: p.name, category: p.category, status: p.status,
              cost: p.allocatedCost, marketValue: p.marketValue, source: p.source,
              bundleId: p.bundleId || null, notes: p.notes || '', soldTo: p.soldTo || '',
              history: Array.isArray(p.history) ? p.history.slice(-20) : [],
            });
            const cleanSale = s => ({
              saleId: s.id, itemName: s.name, buyerName: s.buyerName || '',
              salePrice: s.salePrice, cost: s.cost, profit: s.profit, date: s.date,
              buildId: s.buildId || null, partId: s.partId || null,
              returned: !!s.returned, deleted: !!s.deleted, writeOff: !!s.writeOff,
              reason: s.reason || '',
            });
            const cleanTxn = t => ({
              id: t.id, type: t.type, amount: t.amount, description: t.description || '',
              wallet: t.wallet || '', from: t.from || '', to: t.to || '', date: t.date,
            });

            if (scope === 'summary') {
              const activeParts = (dbState.parts || []).filter(p => p.status === 'available');
              const activeSales = (dbState.sales || []).filter(s => !s.deleted && !s.returned);
              const totalRevenue = activeSales.reduce((sum, s) => sum + (Number(s.salePrice) || 0), 0);
              const totalProfit = activeSales.reduce((sum, s) => sum + (Number(s.profit) || 0), 0);
              const activeBusinessParts = (dbState.parts || []).filter(p => p.status === 'available' || p.status === 'in_build');
              const inventoryMarketValue = activeBusinessParts.reduce((sum,p) => {
                const market=Number(p.marketValue || 0);
                const cost=Number(p.allocatedCost || 0);
                return sum + (market > 0 ? market : cost);
              },0);
              const currentNetWorth = Number(dbState.businessCash || 0) + inventoryMarketValue + Number(dbState.outstandingReceivables || 0) - Number(dbState.totalDebt || 0);
              return JSON.stringify({
                businessCash: dbState.businessCash || 0,
                personalCash: dbState.personalCash || 0,
                inventoryMarketValue,
                outstandingReceivables: dbState.outstandingReceivables || 0,
                totalDebt: dbState.totalDebt || 0,
                netWorth: currentNetWorth,
                activeInventory: activeParts.length,
                inventoryByCategory: activeParts.reduce((a,p) => { a[p.category] = (a[p.category] || 0) + 1; return a; }, {}),
                bundles: (dbState.bundles || []).length,
                activeBuilds: (dbState.builds || []).filter(b => !b.dissolved && !b.sold).length,
                sales: activeSales.length,
                revenue: totalRevenue,
                profit: totalProfit,
                expenses: (dbState.expenses || []).length,
                transactions: (dbState.transactions || []).length,
                quickNotes: (dbState.quickNotes || []).length,
                targetMargin: dbState.settings?.targetMargin ?? null,
              });
            }

            if (scope === 'inventory' || scope === 'item_history') {
              let parts = (dbState.parts || []).filter(p => matches(p, textOf(...(p.history || []).map(h => `${h.date} ${h.event}`))));
              if (scope === 'item_history' && !query) parts = [];
              const result = parts.slice(0, limit).map(cleanPart);
              return JSON.stringify({count: parts.length, items: result});
            }

            if (scope === 'sales') {
              const sales = (dbState.sales || []).filter(s => (toolInput.includeReturned || (!s.returned && !s.deleted)) && matches(s));
              return JSON.stringify({count: sales.length, sales: sales.slice(0, limit).map(cleanSale)});
            }

            if (scope === 'transactions') {
              const txns = (dbState.transactions || []).filter(t => matches(t));
              return JSON.stringify({count: txns.length, returned: Math.min(txns.length, limit), truncated: txns.length > limit, transactions: txns.slice(0, limit).map(cleanTxn)});
            }

            if (scope === 'expenses') {
              const expenses = (dbState.expenses || []).filter(e => matches(e));
              return JSON.stringify({count: expenses.length, expenses: expenses.slice(0, limit)});
            }

            if (scope === 'bundles') {
              const bundles = (dbState.bundles || []).filter(b => matches(b));
              const result = bundles.slice(0, limit).map(b => ({
                ...b,
                parts: (dbState.parts || []).filter(p => p.bundleId === b.id).map(cleanPart),
              }));
              return JSON.stringify({count: bundles.length, bundles: result});
            }

            if (scope === 'builds') {
              const builds = (dbState.builds || []).filter(b => matches(b, (dbState.parts || []).filter(p => b.partIds?.includes(p.id)).map(p => p.name).join(' ')));
              const result = builds.slice(0, limit).map(b => ({
                id: b.id, name: b.name, sold: !!b.sold, dissolved: !!b.dissolved,
                salePrice: b.salePrice, partIds: b.partIds || [],
                parts: (dbState.parts || []).filter(p => b.partIds?.includes(p.id)).map(cleanPart),
              }));
              return JSON.stringify({count: builds.length, builds: result});
            }

            if (scope === 'quick_notes') {
              const notes = (dbState.quickNotes || []).filter(n => matches(n));
              return JSON.stringify({count: notes.length, notes: notes.slice(0, limit)});
            }

            if (scope === 'all') {
              return JSON.stringify({
                summary: {
                  businessCash: dbState.businessCash || 0,
                  personalCash: dbState.personalCash || 0,
                  activeInventory: (dbState.parts || []).filter(p => p.status === 'available').length,
                  activeBuilds: (dbState.builds || []).filter(b => !b.dissolved && !b.sold).length,
                  sales: (dbState.sales || []).filter(s => !s.deleted && !s.returned).length,
                  transactions: (dbState.transactions || []).length,
                },
                inventory: (dbState.parts || []).filter(p => matches(p)).slice(0, limit).map(cleanPart),
                sales: (dbState.sales || []).filter(s => matches(s) && !s.deleted).slice(0, limit).map(cleanSale),
                transactions: (dbState.transactions || []).filter(t => matches(t)).slice(0, limit).map(cleanTxn),
                bundles: (dbState.bundles || []).filter(b => matches(b)).slice(0, limit),
                builds: (dbState.builds || []).filter(b => matches(b)).slice(0, limit),
                expenses: (dbState.expenses || []).filter(e => matches(e)).slice(0, limit),
                quickNotes: (dbState.quickNotes || []).filter(n => matches(n)).slice(0, limit),
                settings: dbState.settings || {},
                netWorthSnapshots: (dbState.netWorthSnapshots || []).slice(-100),
                outstandingReceivables: dbState.outstandingReceivables || 0,
                totalDebt: dbState.totalDebt || 0,
              });
            }

            return `Unknown database scope: ${scope}`;
          }

    default: return undefined;
  }
}
