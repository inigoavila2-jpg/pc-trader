import { cbUid, cbToday, cbFmt } from "../utils.js";


export async function handleNavigationTool(toolName, toolInput, ctx) {
  const { liveState, dispatch, setTab, setFormData, toast, pendingImageRef, uploadImageToPocketBase, messages } = ctx;
  switch (toolName) {
          case 'navigate_tabs': {
            const validTabs = ['Dashboard', 'Buy', 'Inventory', 'Builds', 'Sell', 'History', 'Settings'];
            const tab = validTabs.find(t => t.toLowerCase() === (toolInput.tabName || '').toLowerCase());
            if (tab) { setTab(tab); return `Navigated to ${tab} tab`; }
            return `Invalid tab: ${toolInput.tabName}. Valid tabs are: ${validTabs.join(', ')}`;
          }


          case 'pre_fill_buy_form': {
            const { name, cost, category, domain, marketPrice } = toolInput;
            if (setFormData) {
              setFormData('buy', {
                singleName: name || '',
                singleCost: String(cost || ''),
                singleMarket: String(marketPrice || cost || ''),
                singleCat: category || 'Other',
                singleDomain: domain || 'pc',
              });
              setTab('Buy');
              return `Pre-filled the Buy form with ${name} (₱${cost}). Waiting for the user to review and submit it.`;
            }
            return 'Unable to pre-fill form';
          }


          case 'add_item_to_inventory': {
            const { name, cost, marketPrice, category, domain, notes, quantity } = toolInput;
            if (!name || !cost) return 'Missing name or cost — ask the user for the missing detail.';
            const qty = Math.max(1, Math.floor(Number(quantity) || 1));

            let photoFields = { photoUrl: '', photoRecordId: '' };
            if (pendingImageRef.current) {
              const uploaded = await uploadImageToPocketBase(pendingImageRef.current);
              if (uploaded) photoFields = uploaded;
              pendingImageRef.current = null; // consumed — don't reattach to a later unrelated add
            }

            // Quantity creates N independent inventory records (same pattern as the Buy form) so
            // each unit can be individually sold, put in a build, or marked defective on its own —
            // a shared "count" field would require rewriting every status-based screen in the app.
            const newParts = Array.from({ length: qty }, (_, i) => ({
              id: cbUid(),
              name,
              category: category || 'Other',
              marketValue: marketPrice || cost,
              allocatedCost: cost,
              source: 'AI Assistant',
              bundleId: null,
              status: 'available',
              notes: notes || '',
              soldTo: '',
              photoUrl: i === 0 ? photoFields.photoUrl : '',
              photoRecordId: i === 0 ? photoFields.photoRecordId : '',
              domain: domain || 'pc',
              history: [{ date: cbToday(), event: `Added via AI Assistant for ${cbFmt(cost)}` }],
            }));

            dispatch({ type: 'ADD_PARTS', parts: newParts });
            toast?.(qty > 1 ? `${qty}× ${name} added to inventory ✓` : `${name} added to inventory ✓`, 'success');
            return `Added ${qty > 1 ? `${qty} units of "${name}"` : `"${name}"`} to inventory — ${cbFmt(cost)} per unit, market value ${cbFmt(marketPrice || cost)} per unit${photoFields.photoUrl ? ', photo attached to the first unit' : ''}. Now available in stock${qty > 1 ? ' as separate trackable items' : ''}.`;
          }


          case 'query_pocketbase_inventory': {
            const available = liveState.parts.filter(p => p.status === 'available');
            const summary = {
              total: available.length,
              byCategory: {},
              items: available.slice(0, 15).map(p => ({
                name: p.name, category: p.category, cost: p.allocatedCost, market: p.marketValue,
              })),
            };
            available.forEach(p => { summary.byCategory[p.category] = (summary.byCategory[p.category] || 0) + 1; });
            return JSON.stringify(summary);
          }

    default: return undefined;
  }
}
