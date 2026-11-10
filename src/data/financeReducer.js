import { today, uid, categoryKey, findBuiltInCategory, normalizeAccount, withAccountDelta } from "./model.js";

export function financeReducer(state, action) {
  switch (action.type) {
    case "SET_THEME_MODE":
          return {...state, themeMode:action.mode === "light" ? "light" : "dark"};
    case "SET_ACTIVE_THEME_SLOT": {
          const slot=Number(action.slot);
          if(!Number.isInteger(slot)||slot<1||slot>5)return state;
          if(slot!==1&&!state.themePaletteSlots?.[slot])return state;
          return {...state,activeThemeSlot:slot};
        }
    case "SAVE_THEME_PALETTE_SLOT": {
          const slot=Number(action.slot);
          if(!Number.isInteger(slot)||slot<2||slot>5||!action.colors)return state;
          return {
            ...state,
            activeThemeSlot:slot,
            themeMode:action.mode === "light" ? "light" : "dark",
            themePaletteSlots:{...(state.themePaletteSlots||{}),[slot]:{
              name:String(action.name||`Theme ${slot}`),
              mode:action.mode === "light" ? "light" : "dark",
              colors:action.colors,
              updatedAt:new Date().toISOString(),
            }}
          };
        }
    case "SET_SETTING":
          return {...state, settings:{...state.settings,[action.key]:action.value}};
    
        // Category manager — custom categories persist in state; built-ins can be hidden/re-enabled.
        // Category names are case-insensitive and whitespace-normalized so duplicates like
        // "iPhone", "iphone", and " IPhone " cannot be created. Removing any category moves
        // existing inventory items into the always-available "Other" bucket.
    case "ADD_CATEGORY": {
          const name=String(action.name||"").trim().replace(/\s+/g," ");
          const domain=action.domain==="general"?"general":"pc_part";
          if(!name)return state;
          const key=categoryKey(name);
          const builtIn=findBuiltInCategory(name);
          if(builtIn){
            return {...state,hiddenCategories:(state.hiddenCategories||[]).filter(c=>categoryKey(c)!==key)};
          }
          if((state.customCategories||[]).some(c=>categoryKey(c?.name)===key))return state;
          return {...state,customCategories:[...(state.customCategories||[]),{name,domain}]};
        }
    case "REMOVE_CATEGORY": {
          const target=String(action.name||"").trim();
          const targetKey=categoryKey(target);
          if(!targetKey || targetKey===categoryKey("Other"))return state;
          const builtIn=findBuiltInCategory(target);
          const customExists=(state.customCategories||[]).some(c=>categoryKey(c?.name)===targetKey);
          if(!builtIn && !customExists)return state;
    
          const parts=state.parts.map(p=>categoryKey(p.category)===targetKey
            ? {...p,category:"Other",history:[...(Array.isArray(p.history)?p.history:[]),{date:today(),event:`Category "${p.category}" removed — moved to Other` }]}
            : p);
    
          return {...state,
            hiddenCategories: builtIn
              ? [...new Set([...(state.hiddenCategories||[]),builtIn])]
              : (state.hiddenCategories||[]),
            customCategories: builtIn
              ? (state.customCategories||[])
              : (state.customCategories||[]).filter(c=>categoryKey(c?.name)!==targetKey),
            parts,
          };
        }
    
        // Quick Actions toolbar's "Note" option — a fast scratchpad entry with no other fields,
        // for jotting something down on the spot without opening a full form.
    case "ADD_QUICK_NOTE": {
          if(!action.text?.trim())return state;
          return {...state, quickNotes:[...(state.quickNotes||[]),{id:uid(),text:action.text.trim(),date:today()}]};
        }
    case "DELETE_QUICK_NOTE":
          return {...state, quickNotes:(state.quickNotes||[]).filter(n=>n.id!==action.id)};
    
        // New business-funds model. Old personal history is retained; new actions use bank/cash.
    case "ADD_EXPENSE": {
          const amount=Number(action.amount||0);
          const account=normalizeAccount(action.account||action.wallet);
          const txn={id:uid(),type:"EXPENSE",amount,description:action.description,wallet:"business",account,date:today()};
          const expense={id:uid(),type:"business",amount,description:action.description,date:today(),wallet:"business",account};
          const base={...state,expenses:[...(state.expenses||[]),expense],transactions:[txn,...(state.transactions||[])]};
          return withAccountDelta(base,account,-amount);
        }
    case "ADD_INCOME": {
          const amount=Number(action.amount||0);
          const account=normalizeAccount(action.account||action.wallet);
          const txn={id:uid(),type:"INCOME",amount,description:action.description,wallet:"business",account,date:today()};
          return withAccountDelta({...state,transactions:[txn,...(state.transactions||[])]},account,amount);
        }
    case "TRANSFER_FUNDS": {
          const amount=Number(action.amount||0);
          const direction=action.direction==="to_personal"?"bank_to_cash":action.direction==="to_business"?"cash_to_bank":action.direction;
          if(amount<=0||!["bank_to_cash","cash_to_bank"].includes(direction))return state;
          const from=direction==="bank_to_cash"?"bank":"cash";
          const to=direction==="bank_to_cash"?"cash":"bank";
          const txn={id:uid(),type:"TRANSFER",amount,description:direction==="bank_to_cash"?"Transfer: Business Bank → Cash":"Transfer: Cash → Business Bank",from,to,account:from,date:today()};
          const afterFrom=withAccountDelta({...state,transactions:[txn,...(state.transactions||[])]},from,-amount);
          return withAccountDelta(afterFrom,to,amount);
        }
    case "UPDATE_LIQUID_CASH":
          return withAccountDelta(state,action.account||"bank",Number(action.amount||0));
    
        // Reverses a completed sale: removes it from active totals (soft-deleted, not erased — kept
        // for the "Returned sales" filter), and returns the part(s)/build back to available inventory.
    default: return undefined;
  }
}
