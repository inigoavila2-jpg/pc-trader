import { fmt, today, uid, normalizeAccount, withAccountDelta } from "./model.js";

export function salesReducer(state, action) {
  switch (action.type) {
    case "SELL": {
          const {mode,id,sale}=action;
          const account=normalizeAccount(sale.paymentAccount||sale.account);
          const amount=Number(sale.salePrice||0);
          const saleWithAccount={...sale,paymentAccount:account};
          const txn={id:uid(),type:"SALE",amount,description:`Sold ${sale.name}${sale.buyerName?` to ${sale.buyerName}`:""}`,wallet:"business",account,date:today()};
          if(mode==="part"){
            const base={...state,sales:[...state.sales,saleWithAccount],transactions:[txn,...(state.transactions||[])],
              parts:state.parts.map(p=>p.id===id?{...p,status:"sold",soldTo:sale.buyerName,history:[...p.history,{date:today(),event:`Sold to ${sale.buyerName||"buyer"} for ${fmt(amount)} — profit ${fmt(sale.profit)}` }]}:p)};
            return withAccountDelta(base,account,amount);
          }
          const build=state.builds.find(b=>b.id===id);
          const base={...state,sales:[...state.sales,saleWithAccount],transactions:[txn,...(state.transactions||[])],
            builds:state.builds.map(b=>b.id===id?{...b,sold:true}:b),
            parts:state.parts.map(p=>build?.partIds.includes(p.id)?{...p,status:"sold",soldTo:sale.buyerName,history:[...p.history,{date:today(),event:`Sold in build "${build.name}" to ${sale.buyerName||"buyer"} for ${fmt(amount)}` }]}:p)};
          return withAccountDelta(base,account,amount);
        }
    case "UNDO_SALE": {
          const {saleId,reason,buildDisposition}=action; // buildDisposition: "reactivate" | "disassemble" — only meaningful when sale.buildId is set
          const sale=state.sales.find(s=>s.id===saleId);
          if(!sale)return state;
          let parts=state.parts;
          let builds=state.builds;
          if(sale.buildId){
            const build=state.builds.find(b=>b.id===sale.buildId);
            const disposition=buildDisposition||"disassemble"; // safe default: fully free the parts rather than silently resurrect a sellable build
            if(disposition==="reactivate"){
              // The assembled PC itself came back (e.g. buyer returned it) — keep it as one sellable
              // unit again. Parts go to "in_build", NOT "available" — this is what stops them from
              // being cherry-picked into a different build while this one still claims them.
              builds=state.builds.map(b=>b.id===sale.buildId?{...b,sold:false}:b);
              parts=state.parts.map(p=>build?.partIds.includes(p.id)
                ? {...p,status:"in_build",soldTo:"",history:[...p.history,{date:today(),event:`Sale undone (${reason}) — build "${build.name}" reactivated`}]}
                : p);
            } else {
              // Disassemble — permanently break the build apart. Marking dissolved:true (not just
              // sold:false) is the actual fix: a build that's merely "unsold" but still intact would
              // keep claiming these same partIds while they're free to be picked into a new build —
              // exactly the bug where one part ends up used on two different builds.
              builds=state.builds.map(b=>b.id===sale.buildId?{...b,sold:false,dissolved:true}:b);
              parts=state.parts.map(p=>build?.partIds.includes(p.id)
                ? {...p,status:"available",soldTo:"",history:[...p.history,{date:today(),event:`Sale undone (${reason}) — build disassembled, returned to inventory`}]}
                : p);
            }
          } else if(sale.partId){
            parts=state.parts.map(p=>p.id===sale.partId
              ? {...p,status:"available",soldTo:"",history:[...p.history,{date:today(),event:`Sale undone (${reason}) — returned to inventory`}]}
              : p);
          }
          // The cash from this sale isn't real anymore once the item goes back to inventory — reverse it.
          // Guarded by sale.returned so the same sale can't have its cash pulled back twice.
          const alreadyReversed=sale.returned;
          const account=normalizeAccount(sale.paymentAccount||sale.account);
          const reversalTxn={id:uid(),type:"REVERSAL",amount:sale.salePrice,description:`Sale undone: ${sale.name}`,wallet:"business",account,date:today()};
          const base={...state,parts,builds,
            transactions:alreadyReversed?(state.transactions||[]):[reversalTxn,...(state.transactions||[])],
            sales:state.sales.map(s=>s.id===saleId?{...s,returned:true,returnReason:reason,returnedAt:today()}:s)};
          return alreadyReversed?base:withAccountDelta(base,account,-Number(sale.salePrice||0));
        }
    case "EDIT_SALE": {
          const {saleId,changes}=action;
          return {...state, sales: state.sales.map(s=>s.id===saleId
            ? {...s,...changes,profit:(changes.salePrice??s.salePrice)-s.cost,edited:true,editedAt:today()}
            : s)};
        }
    
        // Soft-deletes a sale record. mode "record-only" just hides it from active lists (kept for
        // the "Deleted records" filter). mode "undo-and-return" also reverses the sale like UNDO_SALE.
    case "DELETE_SALE": {
          const {saleId,mode,buildDisposition}=action; // buildDisposition: "reactivate" | "disassemble" — only meaningful when sale.buildId is set
          const sale=state.sales.find(s=>s.id===saleId);
          if(!sale)return state;
          let parts=state.parts;
          let builds=state.builds;
          let cashReversal=0;
          let extraTxns=[];
          if(mode==="undo-and-return"){
            if(sale.buildId){
              const build=state.builds.find(b=>b.id===sale.buildId);
              const disposition=buildDisposition||"disassemble"; // safe default, matches UNDO_SALE
              if(disposition==="reactivate"){
                builds=state.builds.map(b=>b.id===sale.buildId?{...b,sold:false}:b);
                parts=state.parts.map(p=>build?.partIds.includes(p.id)
                  ? {...p,status:"in_build",soldTo:"",history:[...p.history,{date:today(),event:`Sale record deleted — build "${build.name}" reactivated`}]}
                  : p);
              } else {
                builds=state.builds.map(b=>b.id===sale.buildId?{...b,sold:false,dissolved:true}:b);
                parts=state.parts.map(p=>build?.partIds.includes(p.id)
                  ? {...p,status:"available",soldTo:"",history:[...p.history,{date:today(),event:"Sale record deleted — build disassembled, returned to inventory"}]}
                  : p);
              }
            } else if(sale.partId){
              parts=state.parts.map(p=>p.id===sale.partId
                ? {...p,status:"available",soldTo:"",history:[...p.history,{date:today(),event:"Sale record deleted — returned to inventory"}]}
                : p);
            }
            // Only pull the cash back if it hasn't already been reversed by an earlier undo on this sale.
            if(!sale.returned){
              cashReversal=Number(sale.salePrice||0);
              extraTxns=[{id:uid(),type:"REVERSAL",amount:cashReversal,description:`Sale deleted & returned: ${sale.name}`,wallet:"business",account:normalizeAccount(sale.paymentAccount||sale.account),date:today()}];
            }
          }
          const base={...state,parts,builds,transactions:[...extraTxns,...(state.transactions||[])],
            sales: state.sales.map(s=>s.id===saleId?{...s,deleted:true,deletedAt:today(),returned:mode==="undo-and-return"||s.returned}:s)
          };
          return cashReversal>0?withAccountDelta(base,normalizeAccount(sale.paymentAccount||sale.account),-cashReversal):base;
        }
    default: return undefined;
  }
}
