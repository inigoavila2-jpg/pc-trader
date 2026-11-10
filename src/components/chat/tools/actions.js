import { cbUid, cbToday, cbFmt } from "../utils.js";


export async function handleActionsTool(toolName, toolInput, ctx) {
  const { liveState, dispatch, setTab, setFormData, toast, pendingImageRef, uploadImageToPocketBase, messages } = ctx;
  switch (toolName) {
          case 'sell_item': {
            const { itemName, salePrice, buyerName } = toolInput;
            const q = (itemName || '').toLowerCase();
            const part = liveState.parts.find(p => p.status === 'available' && p.name.toLowerCase().includes(q));
            if (part) {
              const profit = salePrice - part.allocatedCost;
              const sale = { id: cbUid(), partId: part.id, name: part.name, cost: part.allocatedCost, salePrice, profit, buyerName: buyerName || '', date: cbToday() };
              dispatch({ type: 'SELL', mode: 'part', id: part.id, sale });
              toast?.(`${part.name} sold for ${cbFmt(salePrice)} ✓`, 'success');
              return `Sold "${part.name}" for ${cbFmt(salePrice)} — profit ${cbFmt(profit)}.`;
            }
            const build = liveState.builds.find(b => !b.dissolved && !b.sold && b.name.toLowerCase().includes(q));
            if (build) {
              const buildParts = liveState.parts.filter(p => build.partIds.includes(p.id));
              const cost = buildParts.reduce((s, p) => s + p.allocatedCost, 0);
              const profit = salePrice - cost;
              // Snapshot components now — this is what keeps the Parts Breakdown working even if
              // the build record itself gets deleted later (Postgres nulls sales.build_id via
              // ON DELETE SET NULL when that happens, independent of anything in this app).
              const buildPartsSnapshot = buildParts.map(p => ({ id: p.id, name: p.name, category: p.category, allocatedCost: p.allocatedCost, marketValue: p.marketValue, photoUrl: p.photoUrl }));
              const sale = { id: cbUid(), buildId: build.id, name: build.name, cost, salePrice, profit, buyerName: buyerName || '', date: cbToday(), buildPartsSnapshot };
              dispatch({ type: 'SELL', mode: 'build', id: build.id, sale });
              toast?.(`${build.name} sold for ${cbFmt(salePrice)} ✓`, 'success');
              return `Sold build "${build.name}" for ${cbFmt(salePrice)} — profit ${cbFmt(profit)}.`;
            }
            return `Couldn't find an available item or active build matching "${itemName}". Try query_pocketbase_inventory to see what's actually in stock.`;
          }


          case 'mark_item_defective': {
            const { itemName, reason } = toolInput;
            const q = (itemName || '').toLowerCase();
            const part = liveState.parts.find(p => (p.status === 'available' || p.status === 'in_build') && p.name.toLowerCase().includes(q));
            if (!part) return `Couldn't find an item matching "${itemName}" that isn't already sold or defective.`;
            dispatch({ type: 'MARK_DEFECTIVE', id: part.id, reason: reason || '' });
            toast?.(`${part.name} marked defective ✓`, 'warn');
            return `Marked "${part.name}" as defective — recorded a loss of ${cbFmt(part.allocatedCost)}.`;
          }


          case 'add_income': {
            const { amount, description, wallet } = toolInput;
            if (!amount || amount <= 0) return 'Missing or invalid amount — ask the user how much.';
            const safeWallet = wallet === 'personal' ? 'personal' : 'business';
            dispatch({ type: 'ADD_INCOME', amount, description: description || 'Income', wallet: safeWallet });
            toast?.(`+${cbFmt(amount)} added to ${safeWallet} wallet ✓`, 'success');
            return `Logged ${cbFmt(amount)} income to the ${safeWallet} wallet for "${description || 'income'}". Wallet updated.`;
          }


          case 'log_expense': {
            const { amount, description, wallet } = toolInput;
            if (!amount || amount <= 0) return 'Missing or invalid amount — ask the user how much.';
            const safeWallet = wallet === 'personal' ? 'personal' : 'business';
            const expenseType = safeWallet === 'personal' ? 'personal_draw' : 'business';
            dispatch({ type: 'ADD_EXPENSE', expenseType, amount, description: description || 'Expense', wallet: safeWallet });
            toast?.(`-${cbFmt(amount)} logged from ${safeWallet} wallet ✓`, 'warn');
            return `Logged a ${cbFmt(amount)} expense from the ${safeWallet} wallet for "${description || 'expense'}". Wallet updated.`;
          }


          case 'transfer_funds': {
            const { amount, direction } = toolInput;
            if (!amount || amount <= 0) return 'Missing or invalid amount — ask the user how much.';
            const safeDirection = direction === 'to_business' ? 'to_business' : 'to_personal';
            dispatch({ type: 'TRANSFER_FUNDS', amount, direction: safeDirection });
            toast?.(`Transferred ${cbFmt(amount)} ✓`, 'success');
            return `Transferred ${cbFmt(amount)} ${safeDirection === 'to_personal' ? 'from the business wallet to the personal wallet' : 'from the personal wallet to the business wallet'}.`;
          }


          case 'query_wallet_balances': {
            return JSON.stringify({
              businessWallet: liveState.businessCash || 0,
              personalWallet: liveState.personalCash || 0,
            });
          }


          case 'find_builds': {
            const q = (toolInput.query || '').toLowerCase();
            const matches = (liveState.builds || [])
              .filter(b => !b.dissolved && !b.sold)
              .filter(b => b.name.toLowerCase().includes(q))
              .slice(0, 10)
              .map(b => ({
                buildId: b.id,
                name: b.name,
                currentParts: liveState.parts.filter(p => b.partIds.includes(p.id)).map(p => p.name),
              }));
            if (!matches.length) return `No active builds found matching "${toolInput.query}".`;
            return JSON.stringify(matches);
          }


          case 'modify_build': {
            const { buildId, addPartNames = [], removePartNames = [] } = toolInput;
            const build = (liveState.builds || []).find(b => b.id === buildId && !b.dissolved && !b.sold);
            if (!build) return `No active build found with buildId "${buildId}". Call find_builds again to get the correct ID.`;

            const notes = [];
            const addPartIds = [];
            for (const name of addPartNames) {
              const q = name.toLowerCase();
              const candidates = liveState.parts.filter(p => p.status === 'available' && p.name.toLowerCase().includes(q));
              if (candidates.length === 0) { notes.push(`couldn't find an available part matching "${name}"`); continue; }
              if (candidates.length > 1) { notes.push(`"${name}" matched ${candidates.length} available parts — be more specific`); continue; }
              addPartIds.push(candidates[0].id);
            }

            const buildParts = liveState.parts.filter(p => build.partIds.includes(p.id));
            const removePartIds = [];
            for (const name of removePartNames) {
              const q = name.toLowerCase();
              const candidates = buildParts.filter(p => p.name.toLowerCase().includes(q));
              if (candidates.length === 0) { notes.push(`couldn't find "${name}" currently in this build`); continue; }
              if (candidates.length > 1) { notes.push(`"${name}" matched ${candidates.length} parts in this build — be more specific`); continue; }
              removePartIds.push(candidates[0].id);
            }

            if (addPartIds.length === 0 && removePartIds.length === 0) {
              return `Nothing to change — ${notes.join('; ') || 'no valid part names were given'}.`;
            }

            dispatch({ type: 'EDIT_BUILD_PARTS', buildId, addPartIds, removePartIds });
            const bits = [];
            if (addPartIds.length) bits.push(`added ${addPartIds.length}`);
            if (removePartIds.length) bits.push(`removed ${removePartIds.length}`);
            toast?.(`"${build.name}" updated — ${bits.join(', ')} ✓`, 'success');
            let result = `Updated "${build.name}" — ${bits.join(', ')}.`;
            if (notes.length) result += ` Note: ${notes.join('; ')}.`;
            return result;
          }

    default: return undefined;
  }
}
