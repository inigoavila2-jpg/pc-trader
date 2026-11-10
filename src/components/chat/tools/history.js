


export async function handleHistoryTool(toolName, toolInput, ctx) {
  const { liveState, dispatch, setTab, setFormData, toast, pendingImageRef, uploadImageToPocketBase, messages } = ctx;
  switch (toolName) {
          case 'query_chat_history': {
            const q = String(toolInput.query || '').trim().toLowerCase();
            const limit = Math.min(50, Math.max(1, Math.floor(Number(toolInput.limit) || 20)));
            const history = Array.isArray(messages) ? messages : [];
            const matches = history.filter(m => !q || String(m.text || '').toLowerCase().includes(q));
            return JSON.stringify(matches.slice(-limit).map(m => ({
              role: m.role,
              text: m.text,
              created: m.created || m.date || m.createdAt || null,
            })));
          }


          case 'find_sales': {
            const q = (toolInput.query || '').toLowerCase();
            const matches = liveState.sales
              .filter(s => !s.deleted)
              .filter(s => (s.name || '').toLowerCase().includes(q) || (s.buyerName || '').toLowerCase().includes(q))
              .slice(0, 10)
              .map(s => ({
                saleId: s.id,
                itemName: s.name,
                buyerName: s.buyerName || '(no buyer name)',
                salePrice: s.salePrice,
                profit: s.profit,
                date: s.date,
                alreadyReturned: !!s.returned,
                isBuild: !!s.buildId,
              }));
            if (!matches.length) return `No transactions found matching "${toolInput.query}".`;
            return JSON.stringify(matches);
          }


          case 'delete_transaction': {
            const { saleId, returnToInventory, buildDisposition } = toolInput;
            const sale = liveState.sales.find(s => s.id === saleId && !s.deleted);
            if (!sale) return `No active sale found with saleId "${saleId}". Call find_sales again to get the correct ID.`;

            if (returnToInventory && sale.buildId && !buildDisposition) {
              return `This is a build sale ("${sale.name}"). Ask the user: should the build go back to Builds as one sellable unit (reactivate), or be broken apart into individually available parts (disassemble)? Call delete_transaction again with the same saleId, returnToInventory: true, and buildDisposition set to "reactivate" or "disassemble" once they answer. Do not guess.`;
            }

            dispatch({ type: 'DELETE_SALE', saleId, mode: returnToInventory ? 'undo-and-return' : 'record-only', buildDisposition });
            const outcome = !returnToInventory ? ''
              : sale.buildId
                ? (buildDisposition === 'reactivate' ? ', and the build was put back in Builds as one sellable unit' : ', and the build was disassembled — its parts are individually available again')
                : ', and returned the item to available inventory';
            toast?.(`Transaction with ${sale.buyerName || 'buyer'} deleted${returnToInventory ? (sale.buildId && buildDisposition === 'reactivate' ? ' — build reactivated' : ' — returned to inventory') : ''} ✓`, 'success');
            return `Deleted the sale of "${sale.name}" to ${sale.buyerName || 'the buyer'}${outcome}.`;
          }


          case 'attach_photo_to_part': {
            const { itemId, itemName } = toolInput;
            if (!pendingImageRef.current) return 'No attached image found for this turn. Please attach a photo then try again.';
            const uploaded = await uploadImageToPocketBase(pendingImageRef.current);
            pendingImageRef.current = null;
            if (!uploaded) return 'Image upload failed — the photo could not be attached.';

            let part = null;
            if (itemId) {
              part = liveState.parts.find(p => p.id === itemId);
            }
            if (!part && itemName) {
              const q = itemName.toLowerCase();
              const matches = liveState.parts.filter(p => p.name.toLowerCase().includes(q));
              if (matches.length === 1) {
                part = matches[0];
              } else if (matches.length > 1) {
                return `Multiple parts match "${itemName}". Please provide the exact item ID or a more specific name.`;
              }
            }
            if (!part) return `Could not find a part matching "${itemName || itemId || ''}".`;

            dispatch({ type: 'UPDATE_PART', id: part.id, changes: { photoUrl: uploaded.photoUrl, photoRecordId: uploaded.photoRecordId }, desc: 'Attached photo to existing item' });
            toast?.(`Photo attached to ${part.name} ✓`, 'success');
            return `Attached the photo to "${part.name}".`;
          }


          case 'attach_photo_to_sale': {
            const { saleId } = toolInput;
            if (!saleId) return 'saleId is required to attach a photo to a sale.';
            if (!pendingImageRef.current) return 'No attached image found for this turn. Please attach a photo then try again.';
            const uploaded = await uploadImageToPocketBase(pendingImageRef.current);
            pendingImageRef.current = null;
            if (!uploaded) return 'Image upload failed — the photo could not be attached.';

            const sale = liveState.sales.find(s => s.id === saleId && !s.deleted);
            if (!sale) return `No active sale found with saleId "${saleId}".`;

            dispatch({ type: 'EDIT_SALE', saleId, changes: { proofPhotoUrl: uploaded.photoUrl, proofPhotoRecordId: uploaded.photoRecordId } });
            toast?.(`Photo attached to sale ${sale.name} ✓`, 'success');
            return `Attached the photo to sale "${sale.name}".`;
          }

    default: return undefined;
  }
}
