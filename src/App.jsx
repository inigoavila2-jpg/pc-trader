import { useState, useEffect, useRef, useCallback, createContext, useContext, Fragment } from "react";
import { GoogleGenAI } from "@google/genai";
import { AIAgentChatbox } from "./components/AIAgentChatbox";
import {
  LayoutDashboard, ShoppingCart, Boxes, Wrench, Banknote, History as HistoryIcon, Settings as SettingsIcon,
  Search, X, Check, ChevronDown, ChevronUp, ChevronRight, Plus, Minus, Camera, Trash2, Pencil, Copy,
  AlertTriangle, CircleAlert, ArrowLeftRight, TrendingUp, Wallet, Sun, Moon, Zap, Receipt,
  User, Link as LinkIcon, Info, ArrowRight, Loader2,
  CheckCircle2, XCircle, PackageX, ClipboardList, StickyNote, Undo2,
  Monitor, Cpu, ClipboardCopy, PackageCheck,
  Tag, FileDown, Sparkles,
} from "lucide-react";

/* ═══════════════════════════════════════════
   GLOBALS & UTILS
═══════════════════════════════════════════ */
const CURRENCY = "₱";
const fmt = (n) => `${CURRENCY}${Number(n).toLocaleString("en-PH",{minimumFractionDigits:0,maximumFractionDigits:0})}`;
const pct = (n) => `${(n*100).toFixed(1)}%`;
const today = () => new Date().toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"});
let _id = Date.now();
const uid = () => `id_${_id++}`;
const CATEGORIES = ["GPU","CPU","Motherboard","CPU+MB","RAM","PSU","Storage","Cooler","Case","Monitor","Mouse","Keyboard","Other"];

// Every built-in category is a PC part by definition. Custom categories (added via the
// "+ Add Category" picker) carry their own domain in state.customCategories, looked up at
// render/dispatch time rather than re-derived from the category name string.
function domainOf(category, customCategories){
  if(CATEGORIES.includes(category))return "pc_part";
  const custom=customCategories?.find(c=>c.name===category);
  return custom?custom.domain:"pc_part"; // safe default — never silently misfile into General Assets
}
const initialState = { bundles:[], parts:[], builds:[], sales:[], settings:{ targetMargin:30 }, customCategories:[], quickNotes:[], businessCash:14500, personalCash:0, expenses:[], transactions:[], netWorthSnapshots:[], outstandingReceivables:0, totalDebt:0 };

// Historical financial snapshots are the source of truth for net-worth-over-time analysis.
// One snapshot is kept per local calendar day; when the business changes during the day,
// that day's snapshot is replaced with the newest state. This keeps the history compact while
// still ensuring that a daily snapshot always reflects the latest business position.
const localISODate = (date=new Date()) => {
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
};

const calculateNetWorthSnapshot = (state, date=localISODate()) => {
  const parts=Array.isArray(state?.parts)?state.parts:[];
  const activeInventory=parts.filter(p=>p.status==='available'||p.status==='in_build');
  const inventoryMarketValue=activeInventory.reduce((sum,p)=>{
    const market=Number(p?.marketValue||0);
    const cost=Number(p?.allocatedCost||0);
    return sum+(market>0?market:cost);
  },0);
  const inventoryCost=activeInventory.reduce((sum,p)=>sum+Number(p?.allocatedCost||0),0);
  const businessCash=Number(state?.businessCash||0);
  const outstandingReceivables=Number(state?.outstandingReceivables||0);
  const totalDebt=Number(state?.totalDebt||0);
  const netWorth=businessCash+inventoryMarketValue+outstandingReceivables-totalDebt;

  return {
    id:`nw_${date}`,
    date,
    capturedAt:new Date().toISOString(),
    businessCash,
    inventoryCost,
    inventoryMarketValue,
    outstandingReceivables,
    totalDebt,
    netWorth,
    activeInventoryCount:activeInventory.length,
  };
};

const recordNetWorthSnapshot = (state) => {
  const snapshot=calculateNetWorthSnapshot(state);
  const existing=Array.isArray(state?.netWorthSnapshots)?state.netWorthSnapshots:[];
  const next=[...existing.filter(s=>s.date!==snapshot.date),snapshot]
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  return {...state,netWorthSnapshots:next};
};

const SNAPSHOT_ACTIONS = new Set([
  'ADD_BUNDLE','ADD_PARTS','UPDATE_PART','SELL','ADD_EXPENSE','ADD_INCOME','TRANSFER_FUNDS',
  'UPDATE_LIQUID_CASH','UNDO_SALE','DELETE_SALE','DELETE_PART','DUPLICATE_PART','DELETE_BUILD',
  'DELETE_BUNDLE','MARK_DEFECTIVE'
]);

/* ═══════════════════════════════════════════
   REDUCER
═══════════════════════════════════════════ */
function reducer(state, action) {
  switch(action.type) {
    case "ADD_BUNDLE": {
      const bundleCost = action.bundle.purchasePrice || 0;
      const bundleTxn = {id:uid(), type:"PURCHASE", amount:bundleCost,
        description:`Bought bundle: ${action.bundle.name||"Untitled bundle"}`, wallet:"business", date:today()};
      return {...state, bundles:[...state.bundles,action.bundle], parts:[...state.parts,...action.parts],
        businessCash:(state.businessCash||0)-bundleCost, // cash out for bundle purchase
        transactions:[bundleTxn, ...(state.transactions||[])]};
    }
    case "ADD_PARTS": {
      const totalCost=action.parts.reduce((s,p)=>s+(p.allocatedCost||0),0);
      // Quantity purchases (e.g. buying 3 identical RAM sticks) create N parts with the same
      // name — say "Bought 3× RAM Stick" instead of the generic "Bought 3 items" when that's
      // what actually happened, since it reads much clearer in the Cash Ledger.
      const allSameName=action.parts.length>1&&action.parts.every(p=>p.name===action.parts[0].name);
      const partDesc=action.parts.length===1?`Bought ${action.parts[0].name}`
        :allSameName?`Bought ${action.parts.length}× ${action.parts[0].name}`
        :`Bought ${action.parts.length} items`;
      const purchaseTxn={id:uid(),type:"PURCHASE",amount:totalCost,description:partDesc,wallet:"business",date:today()};
      return {...state, parts:[...state.parts,...action.parts],
        businessCash:(state.businessCash||0)-totalCost, // cash out for purchases
        transactions:[purchaseTxn, ...(state.transactions||[])]};
    }
    case "UPDATE_PART": {
      return {...state, parts: state.parts.map(p => p.id === action.id
        ? {...p, ...action.changes, history:[...p.history,{date:today(),event:`Edited: ${action.desc}`}]}
        : p
      )};
    }
    case "CREATE_BUILD": {
      const {build} = action;
      // Defense in depth: only ever claim parts that are truly available right now. The UI
      // picker already filters to status==="available", but the reducer shouldn't blindly
      // trust whatever partIds it's handed — if a part is already sold or claimed by another
      // build, silently exclude it here rather than letting two builds reference the same part.
      const validPartIds = build.partIds.filter(id => {
        const p = state.parts.find(pp => pp.id === id);
        return p && p.status === "available";
      });
      if (validPartIds.length === 0) return state; // nothing valid to build with — no-op
      const safeBuild = { ...build, partIds: validPartIds };
      return {...state, builds:[...state.builds,safeBuild],
        parts: state.parts.map(p => validPartIds.includes(p.id)
          ? {...p,status:"in_build",history:[...p.history,{date:today(),event:`Added to build: ${build.name}`}]}
          : p
        )};
    }
    case "DISSOLVE_BUILD": {
      const build = state.builds.find(b=>b.id===action.buildId);
      return {...state,
        builds: state.builds.map(b=>b.id===action.buildId?{...b,dissolved:true}:b),
        parts: state.parts.map(p=>build?.partIds.includes(p.id)&&p.status==="in_build"
          ? {...p,status:"available",history:[...p.history,{date:today(),event:`Removed from build: ${build.name}`}]}
          : p
        )};
    }
    case "EDIT_BUILD_PARTS": {
      // Adds and/or removes parts on a build that's already assembled (and possibly already
      // listed) — without dissolving it first. Same defense-in-depth as CREATE_BUILD: only ever
      // claim parts that are genuinely available right now, and only ever release parts that are
      // genuinely still in_build and actually belong to this specific build. This is what stops
      // an edit from accidentally grabbing a part another build already claims, or releasing a
      // part that was already sold out from under this build some other way.
      const {buildId, addPartIds=[], removePartIds=[]} = action;
      const build = state.builds.find(b=>b.id===buildId);
      if(!build) return state;

      const validAdds = addPartIds.filter(id=>{
        const p = state.parts.find(pp=>pp.id===id);
        return p && p.status==="available";
      });
      const validRemoves = removePartIds.filter(id=>{
        const p = state.parts.find(pp=>pp.id===id);
        return p && p.status==="in_build" && build.partIds.includes(id);
      });
      if(validAdds.length===0 && validRemoves.length===0) return state; // nothing valid to change

      const newPartIds = [...build.partIds.filter(id=>!validRemoves.includes(id)), ...validAdds];

      return {...state,
        builds: state.builds.map(b=>b.id===buildId?{...b,partIds:newPartIds}:b),
        parts: state.parts.map(p=>{
          if(validAdds.includes(p.id))
            return {...p,status:"in_build",history:[...p.history,{date:today(),event:`Added to build: ${build.name}`}]};
          if(validRemoves.includes(p.id))
            return {...p,status:"available",history:[...p.history,{date:today(),event:`Removed from build: ${build.name}`}]};
          return p;
        })
      };
    }
    case "SELL": {
      const {mode,id,sale} = action;
      const saleTxn={id:uid(),type:"SALE",amount:sale.salePrice,
        description:`Sold ${sale.name}${sale.buyerName?` to ${sale.buyerName}`:""}`,wallet:"business",date:today()};
      if(mode==="part") {
        return {...state, sales:[...state.sales,sale],
          businessCash:(state.businessCash||0)+sale.salePrice, // cash in from the sale
          transactions:[saleTxn, ...(state.transactions||[])],
          parts: state.parts.map(p=>p.id===id
            ? {...p,status:"sold",soldTo:sale.buyerName,history:[...p.history,{date:today(),event:`Sold to ${sale.buyerName||"buyer"} for ${fmt(sale.salePrice)} — profit ${fmt(sale.profit)}`}]}
            : p
          )};
      } else {
        const build = state.builds.find(b=>b.id===id);
        return {...state, sales:[...state.sales,sale],
          businessCash:(state.businessCash||0)+sale.salePrice, // cash in from the sale
          transactions:[saleTxn, ...(state.transactions||[])],
          builds: state.builds.map(b=>b.id===id?{...b,sold:true}:b),
          parts: state.parts.map(p=>build?.partIds.includes(p.id)
            ? {...p,status:"sold",soldTo:sale.buyerName,history:[...p.history,{date:today(),event:`Sold in build "${build.name}" to ${sale.buyerName||"buyer"} for ${fmt(sale.salePrice)}`}]}
            : p
          )};
      }
    }
    case "SET_SETTING":
      return {...state, settings:{...state.settings,[action.key]:action.value}};

    // Dynamic Tag Generation — saves a new category permanently with its domain (PC Part or
    // General Asset), so it persists across sessions and appears in future dropdowns.
    case "ADD_CATEGORY": {
      const {name,domain}=action;
      if(!name||state.customCategories?.some(c=>c.name===name)||CATEGORIES.includes(name))return state;
      return {...state, customCategories:[...(state.customCategories||[]),{name,domain}]};
    }

    // Quick Actions toolbar's "Note" option — a fast scratchpad entry with no other fields,
    // for jotting something down on the spot without opening a full form.
    case "ADD_QUICK_NOTE": {
      if(!action.text?.trim())return state;
      return {...state, quickNotes:[...(state.quickNotes||[]),{id:uid(),text:action.text.trim(),date:today()}]};
    }
    case "DELETE_QUICK_NOTE":
      return {...state, quickNotes:(state.quickNotes||[]).filter(n=>n.id!==action.id)};

    // Mixed-Finance Tracker: record business expenses and personal draws, with separate tracking
    // for funds to recover (owner's draw) vs business costs (operation).
    case "ADD_EXPENSE": {
      const {expenseType,amount,description,wallet}=action; // expenseType: "business" | "personal_draw"
      const newExpense={id:uid(),type:expenseType,amount,description,date:today(),wallet};
      const newTransaction={id:uid(),type:"EXPENSE",amount,description,wallet,date:today()};
      if (wallet === "personal") {
        return {...state,
          expenses:[...(state.expenses||[]),newExpense],
          transactions:[newTransaction, ...(state.transactions||[])],
          personalCash:(state.personalCash||0)-amount};
      } else {
        return {...state,
          expenses:[...(state.expenses||[]),newExpense],
          transactions:[newTransaction, ...(state.transactions||[])],
          businessCash:(state.businessCash||0)-amount};
      }
    }
    case "ADD_INCOME": {
      const {amount,description,wallet} = action;
      const newTransaction={id:uid(),type:"INCOME",amount,description,wallet,date:today()};
      return {...state,
        transactions:[newTransaction, ...(state.transactions||[])],
        [`${wallet}Cash`]: (state[`${wallet}Cash`]||0) + amount};
    }
    case "TRANSFER_FUNDS": {
      const { amount, direction } = action;
      const transferRecord={
        id:uid(),
        type:"TRANSFER",
        amount,
        description: direction==="to_personal"?"Transfer to Personal Wallet":"Transfer to Business Wallet",
        from: direction==="to_personal"?"business":"personal",
        to: direction==="to_personal"?"personal":"business",
        date:today(),
      };
      if (direction === "to_personal") {
        return { ...state,
          businessCash: (state.businessCash||0) - amount,
          personalCash: (state.personalCash||0) + amount,
          transactions:[transferRecord, ...(state.transactions||[])] };
      } else {
        return { ...state,
          personalCash: (state.personalCash||0) - amount,
          businessCash: (state.businessCash||0) + amount,
          transactions:[transferRecord, ...(state.transactions||[])] };
      }
    }

    // Direct cash balance update (used by SELL to add revenue, or other revenue sources)
    case "UPDATE_LIQUID_CASH":
      return {...state, businessCash:(state.businessCash||0)+action.amount};

    // Reverses a completed sale: removes it from active totals (soft-deleted, not erased — kept
    // for the "Returned sales" filter), and returns the part(s)/build back to available inventory.
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
      const reversalTxn={id:uid(),type:"REVERSAL",amount:sale.salePrice,description:`Sale undone: ${sale.name}`,wallet:"business",date:today()};
      return {...state, parts, builds,
        businessCash: alreadyReversed?(state.businessCash||0):(state.businessCash||0)-sale.salePrice,
        transactions: alreadyReversed?(state.transactions||[]):[reversalTxn, ...(state.transactions||[])],
        sales: state.sales.map(s=>s.id===saleId?{...s,returned:true,returnReason:reason,returnedAt:today()}:s)
      };
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
          cashReversal=sale.salePrice;
          extraTxns=[{id:uid(),type:"REVERSAL",amount:sale.salePrice,description:`Sale deleted & returned: ${sale.name}`,wallet:"business",date:today()}];
        }
      }
      return {...state, parts, builds,
        businessCash:(state.businessCash||0)-cashReversal,
        transactions:[...extraTxns, ...(state.transactions||[])],
        sales: state.sales.map(s=>s.id===saleId?{...s,deleted:true,deletedAt:today(),returned:mode==="undo-and-return"||s.returned}:s)
      };
    }

    case "DELETE_PART": {
      const target=state.parts.find(p=>p.id===action.id);
      // A part inside an active build must be removed from that build first (dissolve, or
      // remove it from the build) before it can be deleted — otherwise the build's partIds
      // would point at a part that no longer exists, breaking its cost basis and profit math.
      if(target?.status==="in_build")return state;
      return {...state, parts: state.parts.filter(p=>p.id!==action.id)};
    }

    case "DUPLICATE_PART": {
      const src=state.parts.find(p=>p.id===action.id);
      if(!src)return state;
      const copy={...src,id:uid(),status:"available",soldTo:"",
        history:[{date:today(),event:`Duplicated from "${src.name}"`}]};
      return {...state, parts:[...state.parts,copy]};
    }

    case "DELETE_BUILD": {
      const {buildId,returnParts}=action;
      const build=state.builds.find(b=>b.id===buildId);
      return {...state,
        builds: state.builds.filter(b=>b.id!==buildId),
        parts: returnParts
          ? state.parts.map(p=>build?.partIds.includes(p.id)
              ? {...p,status:"available",history:[...p.history,{date:today(),event:`Build "${build.name}" deleted — returned to inventory`}]}
              : p)
          : state.parts.filter(p=>!build?.partIds.includes(p.id))
      };
    }

    // mode "parts-too" removes the bundle and every part that came from it.
    // mode "keep-loose" removes only the bundle record, leaving its parts in inventory as untracked single parts.
    case "DELETE_BUNDLE": {
      const {bundleId,mode}=action;
      if(mode==="parts-too"){
        return {...state,
          bundles: state.bundles.filter(b=>b.id!==bundleId),
          parts: state.parts.filter(p=>p.bundleId!==bundleId)
        };
      }
      return {...state,
        bundles: state.bundles.filter(b=>b.id!==bundleId),
        parts: state.parts.map(p=>p.bundleId===bundleId?{...p,bundleId:null,source:"Untracked (bundle deleted)"}:p)
      };
    }

    // Logs a capital loss and removes the part from active inventory, keeping a record in sales
    // (as a zero/negative-revenue "sale") so it still shows up in Dashboard/History analytics.
    case "MARK_DEFECTIVE": {
      const {id,reason}=action;
      const part=state.parts.find(p=>p.id===id);
      if(!part)return state;
      const loss={id:uid(),partId:part.id,name:part.name,cost:part.allocatedCost,salePrice:0,profit:-part.allocatedCost,
        buyerName:"",date:today(),writeOff:true,reason:reason||""};
      return {...state,
        sales:[...state.sales,loss],
        parts: state.parts.map(p=>p.id===id
          ? {...p,status:"defective",history:[...p.history,{date:today(),event:`Marked defective/write-off${reason?`: ${reason}`:""} — loss of ${fmt(part.allocatedCost)}`}]}
          : p)
      };
    }

    default: return state;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM — "Bench Ledger"
   Grounded in what this app actually is: a workbench for trading PC hardware,
   kept honest by a ledger. Surfaces read like gunmetal tool casings and
   anti-static mats; the brand accent is copper — solder and circuit-trace
   colored, and (usefully, for a trading app) the color of value itself. A
   second accent, teal, marks anything "in progress" the way a multimeter or
   scope trace glows. Money is set in a mono face for ledger-style alignment;
   everything else uses two families with a clear division of labor —
   Space Grotesk carries personality on headings and hero numbers, Inter does
   the quiet work of UI and body text. Every color pair below is verified
   against WCAG AA (4.5:1 for text, 3:1 for large text/UI) — see the "soft"
   tokens for tinted panels and the *Strong tokens for solid button fills.
═══════════════════════════════════════════════════════════════════════════ */
const THEME = {
  dark: {
    mode:"dark",
    bg:"#0E0E0F", bgElevated:"#171615",
    surface:"#171615", surfaceSunken:"#0A0A0A", surfaceHover:"#201F1D",
    border:"#2C2A26", borderStrong:"#3D3A34",
    text:"#F2F0EC", textMuted:"#A8A296", textFaint:"#7A7568",
    accent:"#E8A33D", accentStrong:"#B8791F", accentContrast:"#181206", accentSoft:"rgba(232,163,61,0.14)", accentSoftBorder:"rgba(232,163,61,0.4)",
    info:"#5FAFC9", infoStrong:"#227087", infoSoft:"rgba(95,175,201,0.13)", infoSoftBorder:"rgba(95,175,201,0.36)",
    positive:"#3FC088", positiveStrong:"#167A4D", positiveSoft:"rgba(63,192,136,0.13)", positiveSoftBorder:"rgba(63,192,136,0.36)",
    negative:"#F0716F", negativeStrong:"#C33F3D", negativeSoft:"rgba(240,113,111,0.13)", negativeSoftBorder:"rgba(240,113,111,0.36)",
    warning:"#D8813F", warningSoft:"rgba(216,129,63,0.13)", warningSoftBorder:"rgba(216,129,63,0.36)",
    overlay:"rgba(5,5,5,0.75)", focusRing:"rgba(232,163,61,0.45)",
    shadow:"0 12px 32px rgba(0,0,0,0.5)", shadowSm:"0 2px 10px rgba(0,0,0,0.4)",
  },
  light: {
    mode:"light",
    bg:"#EBD698", bgElevated:"#FFFFFF",
    surface:"#FFFFFF", surfaceSunken:"#F2E9D3", surfaceHover:"#F7F1E3",
    border:"#D9C48F", borderStrong:"#C2A968",
    text:"#1A1A1A", textMuted:"#5C5344", textFaint:"#6B6248",
    accent:"#000000", accentStrong:"#000000", accentContrast:"#FFFFFF", accentSoft:"rgba(0,0,0,0.06)", accentSoftBorder:"rgba(0,0,0,0.22)",
    info:"#35566B", infoStrong:"#294453", infoSoft:"rgba(53,86,107,0.08)", infoSoftBorder:"rgba(53,86,107,0.28)",
    positive:"#1F7A4D", positiveStrong:"#17603C", positiveSoft:"rgba(31,122,77,0.08)", positiveSoftBorder:"rgba(31,122,77,0.28)",
    negative:"#B12B28", negativeStrong:"#8F211F", negativeSoft:"rgba(177,43,40,0.08)", negativeSoftBorder:"rgba(177,43,40,0.3)",
    warning:"#8C6A1F", warningSoft:"rgba(140,106,31,0.08)", warningSoftBorder:"rgba(140,106,31,0.28)",
    overlay:"rgba(20,16,10,0.5)", focusRing:"rgba(0,0,0,0.35)",
    shadow:"0 12px 32px rgba(40,30,10,0.14)", shadowSm:"0 2px 10px rgba(40,30,10,0.09)",
  },
};
const STATUS_TONE = { available:"positive", in_build:"info", sold:"neutral", defective:"negative" };

// Font stacks — Space Grotesk (headings/hero numbers), Inter (UI/body), IBM Plex Mono (money/ledger figures)
const FONT_DISPLAY = "'Space Grotesk',ui-sans-serif,system-ui,sans-serif";
const FONT_BODY = "'Inter',ui-sans-serif,system-ui,-apple-system,sans-serif";
const FONT_MONO = "'IBM Plex Mono',ui-monospace,'SF Mono',Menlo,monospace";
const GOOGLE_FONTS_HREF = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@500;600;700&display=swap";

const ThemeCtx = createContext(THEME.dark);
const useTheme = () => useContext(ThemeCtx);

/* Breakpoint hook — the redesign's responsive shell (sidebar at desktop widths,
   refined top tabs below that) hangs off this single source of truth. */
function useMediaQuery(query){
  const [matches,setMatches]=useState(()=>typeof window!=="undefined"?window.matchMedia(query).matches:false);
  useEffect(()=>{
    const mql=window.matchMedia(query);
    const handler=e=>setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener?mql.addEventListener("change",handler):mql.addListener(handler);
    return()=>{mql.removeEventListener?mql.removeEventListener("change",handler):mql.removeListener(handler);};
  },[query]);
  return matches;
}

function usePrefersReducedMotion(){
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/* Remembers a value in this browser across visits — used only for convenience defaults
   (last category picked, last wallet used), never for anything the server should own. */
function usePersistentState(key,initialValue){
  const [value,setValue]=useState(()=>{
    try{
      const raw=window.localStorage.getItem(key);
      return raw!==null?JSON.parse(raw):initialValue;
    }catch{return initialValue;}
  });
  const setAndPersist=useCallback((next)=>{
    setValue(prev=>{
      const resolved=typeof next==="function"?next(prev):next;
      try{window.localStorage.setItem(key,JSON.stringify(resolved));}catch{}
      return resolved;
    });
  },[key]);
  return [value,setAndPersist];
}

/* ═══════════════════════════════════════════
   MODAL FOCUS TRAP + ESCAPE — previously each
   overlay only closed on backdrop click, which stranded keyboard and screen-reader
   users. One hook, applied everywhere, so the behavior is consistent. */
function useDialogA11y(onClose, active=true){
  const ref=useRef(null);
  useEffect(()=>{
    if(!active)return;
    const node=ref.current;
    const focusables=()=>node?Array.from(node.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')).filter(el=>!el.disabled&&el.offsetParent!==null):[];
    const toFocus=focusables();
    (toFocus[0]||node)?.focus?.();
    const onKey=e=>{
      if(e.key==="Escape"){e.stopPropagation();onClose?.();return;}
      if(e.key==="Tab"){
        const items=focusables();
        if(items.length===0)return;
        const first=items[0], last=items[items.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    };
    document.addEventListener("keydown",onKey,true);
    return()=>document.removeEventListener("keydown",onKey,true);
  },[active,onClose]);
  return ref;
}
/* ═══════════════════════════════════════════
   TOAST — now announced to assistive tech via a visually-hidden aria-live region,
   not just shown visually. Screen-reader users previously had no idea a sale,
   save, or error had happened.
═══════════════════════════════════════════ */
function useToast() {
  const [toasts,setToasts] = useState([]);
  const toast = useCallback((message,type="success") => {
    const id=uid();
    setToasts(p=>[...p,{id,message,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3200);
  },[]);
  return {toasts,toast};
}
const TOAST_ICON = { success:CheckCircle2, error:XCircle, info:Info, warn:AlertTriangle };
function ToastContainer({toasts}) {
  const t=useTheme();
  return (
    <>
      <div aria-live="polite" role="status" style={SR_ONLY}>{toasts.map(x=>x.message).join(". ")}</div>
      <div aria-hidden="true" style={{position:"fixed",top:"calc(14px + env(safe-area-inset-top))",right:14,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none",maxWidth:"calc(100vw - 28px)"}}>
        {toasts.map(x=>{
          const tone=x.type==="success"?t.positive:x.type==="error"?t.negative:x.type==="warn"?t.warning:t.info;
          const Icon=TOAST_ICON[x.type]||Info;
          return (
            <div key={x.id} style={{
              background:t.bgElevated,border:`1px solid ${tone}55`,color:t.text,padding:"10px 14px",borderRadius:10,fontSize:13,fontWeight:500,
              maxWidth:320,animation:"blSlideIn 0.3s cubic-bezier(0.34,1.4,0.64,1)",fontFamily:FONT_BODY,
              display:"flex",alignItems:"center",gap:9,boxShadow:t.shadow
            }}>
              <Icon size={16} color={tone} strokeWidth={2.25} style={{flexShrink:0}}/>
              {x.message}
            </div>
          );
        })}
      </div>
    </>
  );
}
const SR_ONLY={position:"absolute",width:1,height:1,padding:0,margin:-1,overflow:"hidden",clip:"rect(0,0,0,0)",whiteSpace:"nowrap",border:0};

/* ═══════════════════════════════════════════
   ANIMATED NUMBER
═══════════════════════════════════════════ */
function AnimNum({value}) {
  const reduceMotion=usePrefersReducedMotion();
  const [d,setD]=useState(reduceMotion?value:0);
  const prev=useRef(reduceMotion?value:0);
  useEffect(()=>{
    if(reduceMotion){setD(value);prev.current=value;return;}
    const start=prev.current,end=value,diff=end-start;
    if(!diff)return;
    let i=0;const steps=20;
    const tmr=setInterval(()=>{i++;setD(Math.round(start+(diff*i)/steps));if(i>=steps){clearInterval(tmr);prev.current=end;}},16);
    return()=>clearInterval(tmr);
  },[value,reduceMotion]);
  return <>{d.toLocaleString("en-PH")}</>;
}

/* ═══════════════════════════════════════════
   STATUS BADGE — status color now maps through the theme's four-hue semantic
   system (positive/info/neutral/negative) instead of one-off hex values, so it
   stays correct in both themes automatically.
═══════════════════════════════════════════ */
const STATUS_LABEL = { available:"Available", in_build:"In a build", sold:"Sold", defective:"Defective" };
function StatusBadge({s}) {
  const t=useTheme();
  const tone=STATUS_TONE[s]||"neutral";
  const color=tone==="neutral"?t.textMuted:t[tone];
  const bg=tone==="neutral"?(t.mode==="dark"?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)"):`${color}22`;
  const border=tone==="neutral"?t.border:`${color}55`;
  return (
    <span style={{background:bg,border:`1px solid ${border}`,color,fontSize:10.5,padding:"3px 8px",borderRadius:6,
      fontFamily:FONT_BODY,letterSpacing:"0.02em",fontWeight:700,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:4}}>
      <span aria-hidden="true" style={{width:5,height:5,borderRadius:"50%",background:color,flexShrink:0}}/>
      {STATUS_LABEL[s]||s.replace("_"," ")}
    </span>
  );
}

/* ═══════════════════════════════════════════
   PHOTO UPLOAD / THUMB / LIGHTBOX — same upload+compression pipeline, restyled,
   with real labels on the icon-only controls and a 44px-plus tap target on the
   remove button (was 22px).
═══════════════════════════════════════════ */
let _buyVisionClient = null;

function getGeminiVisionClient(){
  const apiKey = import.meta.env?.VITE_GEMINI_KEY || import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.GEMINI_API_KEY || process?.env?.VITE_GEMINI_KEY || process?.env?.GEMINI_API_KEY;
  if(!apiKey) return null;
  if(!_buyVisionClient) _buyVisionClient = new GoogleGenAI({apiKey});
  return _buyVisionClient;
}

function parseJsonResponse(text){
  const raw=String(text||"").trim();
  try{return JSON.parse(raw);}catch{}
  const fenced=raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if(fenced){try{return JSON.parse(fenced[1]);}catch{}}
  const first=raw.indexOf("{");
  const last=raw.lastIndexOf("}");
  if(first>=0&&last>first){try{return JSON.parse(raw.slice(first,last+1));}catch{}}
  return null;
}

function dataUrlParts(dataUrl){
  const match=String(dataUrl||"").match(/^data:([^;]+);base64,(.+)$/s);
  if(!match) throw new Error("Invalid image data");
  return {mimeType:match[1],data:match[2]};
}

async function analyzeBuyImage(dataUrl,{mode="single",existingRows=[]}={}){
  const ai=getGeminiVisionClient();
  if(!ai) throw new Error("Gemini API key is not configured");
  const {mimeType,data}=dataUrlParts(dataUrl);
  const categories=["GPU","CPU","Motherboard","CPU+MB","RAM","PSU","Storage","Cooler","Case","Monitor","Mouse","Keyboard","Other"];
  const prompt=mode==="bundle"
    ? `Analyze this PC hardware buying/listing photo quickly and return ONLY valid JSON. Identify every distinct PC part that is visibly present. Do not invent model numbers or prices. If text from a marketplace listing, receipt, label, or screenshot visibly shows a seller/source or total purchase price, extract it; otherwise use null. For each visible part, use one of these categories: ${categories.join(", ")}.\nReturn exactly this shape:\n{"source":string|null,"purchasePrice":number|null,"parts":[{"name":string,"category":string,"notes":string,"marketValue":number|null,"confidence":number}]}\n` 
    : `Analyze this single PC hardware item photo and return ONLY valid JSON. Read visible brand/model/spec labels. Do not invent details that are not visible. Use one of these categories: ${categories.join(", ")}. If a price is visibly shown, extract it as marketValue; otherwise marketValue must be null.\nReturn exactly this shape:\n{"name":string,"category":string,"notes":string,"marketValue":number|null,"quantity":1,"confidence":number}\n`;
  const result=await ai.models.generateContent({
    model:"gemini-2.5-flash",
    contents:[{role:"user",parts:[{inlineData:{mimeType,data}},{text:prompt}]}],
    config:{temperature:0.1,responseMimeType:"application/json"},
  });
  const parsed=parseJsonResponse(result?.text);
  if(!parsed) throw new Error("AI returned an unreadable result");
  if(mode==="bundle"){
    const parts=Array.isArray(parsed.parts)?parsed.parts.map((p)=>({
      name:String(p?.name||"").trim(),
      category:categories.includes(p?.category)?p.category:"Other",
      notes:String(p?.notes||"").trim(),
      marketValue:Number.isFinite(Number(p?.marketValue))&&Number(p.marketValue)>0?Number(p.marketValue):"",
      confidence:Number.isFinite(Number(p?.confidence))?Math.max(0,Math.min(1,Number(p.confidence))):0,
    })).filter(p=>p.name):[];
    return {
      source:String(parsed.source||"").trim(),
      purchasePrice:Number.isFinite(Number(parsed.purchasePrice))&&Number(parsed.purchasePrice)>0?Number(parsed.purchasePrice):"",
      parts,
    };
  }
  return {
    name:String(parsed.name||"").trim(),
    category:categories.includes(parsed.category)?parsed.category:"Other",
    notes:String(parsed.notes||"").trim(),
    marketValue:Number.isFinite(Number(parsed.marketValue))&&Number(parsed.marketValue)>0?Number(parsed.marketValue):"",
    quantity:Math.max(1,Math.floor(Number(parsed.quantity)||1)),
    confidence:Number.isFinite(Number(parsed.confidence))?Math.max(0,Math.min(1,Number(parsed.confidence))):0,
  };
}

function fileToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("Could not read image"));
    reader.onload=()=>resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function compressImage(file,maxDimension=1280,quality=0.82){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error("Could not read file"));
    reader.onload=()=>{
      img.onerror=()=>reject(new Error("Could not decode image"));
      img.onload=()=>{
        let {width,height}=img;
        if(width>maxDimension||height>maxDimension){
          if(width>height){height=Math.round(height*(maxDimension/width));width=maxDimension;}
          else{width=Math.round(width*(maxDimension/height));height=maxDimension;}
        }
        const canvas=document.createElement("canvas");
        canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext("2d");
        ctx.drawImage(img,0,0,width,height);
        canvas.toBlob(blob=>{
          if(!blob){reject(new Error("Compression failed"));return;}
          resolve(new File([blob],file.name.replace(/\.(png|heic|heif)$/i,".jpg"),{type:"image/jpeg"}));
        },"image/jpeg",quality);
      };
      img.src=reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function PhotoUpload({photoUrl,photoRecordId,onChange,label="Photo",onAnalyze}) {
  const t=useTheme();
  const [status,setStatus]=useState("idle");
  const inputRef=useRef(null);

  const handleFile=async(file)=>{
    if(!file)return;
    if(!file.type.startsWith("image/")){setStatus("error");return;}
    setStatus("compressing");
    try{
      const compressed=await compressImage(file).catch(()=>file);
      const analysisPromise=onAnalyze
        ? fileToDataUrl(compressed).then(dataUrl=>onAnalyze(dataUrl,compressed)).catch(err=>{
            console.error("AI image analysis failed:",err);
            return null;
          })
        : Promise.resolve(null);

      setStatus("uploading");
      const form=new FormData();
      form.append("photo",compressed);
      const res=await fetch("/photo",{method:"POST",body:form});
      if(!res.ok)throw new Error(`Upload failed (${res.status})`);
      const {url,recordId}=await res.json();
      if(photoRecordId){fetch(`/photo/${photoRecordId}`,{method:"DELETE"}).catch(()=>{});}
      onChange({photoUrl:url,photoRecordId:recordId});

      if(onAnalyze){
        setStatus("analyzing");
        await analysisPromise;
      }
      setStatus("idle");
    }catch(err){
      console.error("Photo upload error:",err);
      setStatus("error");
    }
  };

  const removePhoto=()=>{
    if(photoRecordId){fetch(`/photo/${photoRecordId}`,{method:"DELETE"}).catch(()=>{});}
    onChange({photoUrl:"",photoRecordId:""});
  };

  return (
    <div>
      {label&&<div style={{fontSize:12.5,color:t.textMuted,marginBottom:6,fontWeight:500}}>{label}</div>}
      <input ref={inputRef} type="file" accept="image/*" style={SR_ONLY}
        onChange={e=>handleFile(e.target.files?.[0])} aria-label={label||"Upload photo"}/>
      {photoUrl?(
        <div style={{position:"relative",display:"inline-block"}}>
          <img src={photoUrl} alt="" style={{width:96,height:96,objectFit:"cover",borderRadius:10,border:`1px solid ${t.border}`,display:"block"}}/>
          <button onClick={removePhoto} type="button" aria-label="Remove photo" className="bl-focusable"
            style={{position:"absolute",top:-9,right:-9,width:28,height:28,borderRadius:"50%",
            background:t.negativeStrong,border:`2px solid ${t.bg}`,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <X size={14} strokeWidth={2.5}/>
          </button>
        </div>
      ):(
        <button type="button" onClick={()=>inputRef.current?.click()} disabled={status==="uploading"||status==="compressing"||status==="analyzing"} className="bl-focusable"
          style={{width:96,height:96,borderRadius:10,border:`1.5px dashed ${t.borderStrong}`,background:t.surfaceSunken,color:t.textMuted,
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,cursor:(status==="uploading"||status==="compressing"||status==="analyzing")?"wait":"pointer",
            fontSize:11,fontFamily:FONT_BODY,transition:"border-color 0.15s,color 0.15s"}}
          onMouseEnter={e=>{if(status==="idle"){e.currentTarget.style.borderColor=t.accent;e.currentTarget.style.color=t.accent;}}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=t.borderStrong;e.currentTarget.style.color=t.textMuted;}}>
          {status==="compressing"?(
            <><Loader2 size={18} className="bl-spin"/><span>Optimizing…</span></>
          ):status==="uploading"?(
            <><Loader2 size={18} className="bl-spin"/><span>Uploading…</span></>
          ):status==="analyzing"?(
            <><Sparkles size={18} className="bl-spin"/><span>AI analyzing…</span></>
          ):(
            <><Camera size={20} strokeWidth={1.75}/><span>Add photo</span></>
          )}
        </button>
      )}
      {status==="error"&&<div style={{color:t.negative,fontSize:11.5,marginTop:6}}>Upload failed — try again</div>}
    </div>
  );
}

function PhotoThumb({url,size=52,seed=0,onClick,label}) {
  const t=useTheme();
  if(!url)return null;
  const tilt=((seed%5)-2)*1.6;
  const Tag=onClick?"button":"div";
  return (
    <Tag onClick={onClick} type={onClick?"button":undefined} aria-label={onClick?(label||"View photo"):undefined} className={onClick?"bl-focusable":undefined}
      style={{width:size,height:size,flexShrink:0,transform:`rotate(${tilt}deg)`,transition:"transform 0.2s",cursor:onClick?"pointer":"default",
        padding:0,border:"none",background:"none",display:"block"}}
      onMouseEnter={onClick?e=>e.currentTarget.style.transform=`rotate(0deg) scale(1.06)`:undefined}
      onMouseLeave={onClick?e=>e.currentTarget.style.transform=`rotate(${tilt}deg) scale(1)`:undefined}>
      <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:7,border:`2px solid ${t.border}`,boxShadow:t.shadowSm,display:"block"}}/>
    </Tag>
  );
}

function Lightbox({url,onClose}) {
  const t=useTheme();
  const active=!!url;
  const dialogRef=useDialogA11y(onClose,active);
  if(!url)return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo" ref={dialogRef} tabIndex={-1}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"blFadeUp 0.15s ease",outline:"none"}}
      onClick={onClose}>
      <img src={url} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:8,boxShadow:"0 20px 60px rgba(0,0,0,0.7)"}}/>
      <button onClick={onClose} aria-label="Close" className="bl-focusable" style={{position:"absolute",top:18,right:18,width:40,height:40,borderRadius:"50%",
        background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",cursor:"pointer",
        display:"flex",alignItems:"center",justifyContent:"center"}}>
        <X size={18}/>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MODAL SHELL — shared chrome (backdrop, focus trap, Escape, aria-modal) for
   every dialog and bottom sheet in the app, so each modal only has to describe
   its own content, not re-solve accessibility.
═══════════════════════════════════════════ */
function ModalShell({onClose,children,maxWidth=380,label,sheet=false,padding=22}) {
  const t=useTheme();
  const dialogRef=useDialogA11y(onClose,true);
  return (
    <div role="dialog" aria-modal="true" aria-label={label} style={{position:"fixed",inset:0,background:t.overlay,zIndex:1500,
      display:"flex",alignItems:sheet?"flex-end":"center",justifyContent:"center",padding:sheet?0:16}} onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} onClick={e=>e.stopPropagation()} style={{background:t.bgElevated,border:sheet?"none":`1px solid ${t.border}`,
        borderRadius:sheet?"18px 18px 0 0":16,padding:sheet?0:padding,width:"100%",maxWidth,
        maxHeight:sheet?"88vh":"90vh",overflowY:"auto",animation:sheet?"blSlideUp 0.22s cubic-bezier(0.22,1,0.36,1)":"blFadeUp 0.2s ease",
        outline:"none",boxShadow:t.shadow,paddingBottom:sheet?`calc(20px + env(safe-area-inset-bottom))`:padding}}>
        {sheet&&<div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px"}} aria-hidden="true">
          <div style={{width:38,height:4,borderRadius:99,background:t.borderStrong}}/>
        </div>}
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CONFIRM MODAL
═══════════════════════════════════════════ */
function ConfirmModal({title,message,confirmLabel="Delete",danger=true,onConfirm,onCancel,extraChoices}) {
  const t=useTheme();
  return (
    <ModalShell onClose={onCancel} label={title}>
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:8,fontFamily:FONT_DISPLAY}}>{title}</div>
      <div style={{fontSize:13.5,color:t.textMuted,marginBottom:20,lineHeight:1.55}}>{message}</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {extraChoices?extraChoices.map((c,i)=>(
          <Btn key={i} variant={c.variant||"warn"} onClick={c.onClick} style={{width:"100%"}}>{c.label}</Btn>
        )):(
          <Btn variant={danger?"danger":"primary"} onClick={onConfirm} style={{width:"100%"}}>{confirmLabel}</Btn>
        )}
        <Btn variant="ghost" onClick={onCancel} style={{width:"100%"}}>Cancel</Btn>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   CARD
═══════════════════════════════════════════ */
function Card({children,style={},as:As="div",...rest}) {
  const t=useTheme();
  return <As style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:14,padding:18,...style}} {...rest}>{children}</As>;
}

/* ═══════════════════════════════════════════
   BUTTON — six variants, all theme-aware. Solid fills (primary/success) use a
   deep shade with white text verified at 5:1+; soft variants (ghost/info/warn/
   danger) tint the base surface so destructive/secondary actions read as one
   step down in emphasis rather than shouting as loud as the primary action.
═══════════════════════════════════════════ */
function Btn({children,variant="primary",onClick,disabled=false,loading=false,small=false,icon:Icon,style={},type="button",...rest}) {
  const t=useTheme();
  const [pressed,setPressed]=useState(false);
  const VC={
    primary:{bg:t.accentStrong,hov:t.accent,txt:t.accentContrast,bdr:"transparent"},
    ghost:{bg:t.surfaceHover,hov:t.borderStrong,txt:t.text,bdr:t.border},
    danger:{bg:t.negativeSoft,hov:`${t.negative}33`,txt:t.negative,bdr:t.negativeSoftBorder},
    success:{bg:t.positiveStrong,hov:t.positive,txt:"#fff",bdr:"transparent"},
    warn:{bg:t.warningSoft,hov:`${t.warning}33`,txt:t.warning,bdr:t.warningSoftBorder},
    info:{bg:t.infoSoft,hov:`${t.info}33`,txt:t.info,bdr:t.infoSoftBorder},
  };
  const c=VC[variant]||VC.primary;
  return (
    <button
      type={type}
      onClick={()=>{if(!disabled&&!loading){setPressed(true);setTimeout(()=>setPressed(false),100);onClick&&onClick();}}}
      disabled={disabled||loading}
      className="bl-focusable"
      onMouseEnter={e=>{if(!disabled)e.currentTarget.style.background=c.hov;}}
      onMouseLeave={e=>{e.currentTarget.style.background=c.bg;}}
      style={{background:c.bg,color:disabled?t.textFaint:c.txt,border:`1px solid ${c.bdr}`,borderRadius:9,
        padding:small?"7px 12px":"10px 17px",fontSize:small?12:13.5,fontWeight:600,cursor:disabled?"not-allowed":"pointer",
        fontFamily:FONT_BODY,minHeight:small?32:44,
        transition:"background 0.12s,transform 0.1s",transform:pressed?"scale(0.96)":"scale(1)",opacity:disabled?0.5:1,
        display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,...style}} {...rest}>
      {loading?<Loader2 size={small?13:15} className="bl-spin"/>:Icon?<Icon size={small?14:16} strokeWidth={2.25}/>:null}
      {children}
    </button>
  );
}

/* Icon-only button — every icon-only control in the app now gets a real
   accessible name and a floor of 40px so it clears the touch-target guideline. */
function IconBtn({icon:Icon,label,onClick,variant="ghost",size=36,iconSize=16,style={},...rest}){
  const t=useTheme();
  const VC={
    ghost:{bg:"transparent",txt:t.textMuted,hov:t.surfaceHover},
    surface:{bg:t.surfaceHover,txt:t.text,hov:t.borderStrong},
    danger:{bg:"transparent",txt:t.negative,hov:t.negativeSoft},
  };
  const c=VC[variant]||VC.ghost;
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="bl-focusable"
      onMouseEnter={e=>e.currentTarget.style.background=c.hov} onMouseLeave={e=>e.currentTarget.style.background=c.bg}
      style={{width:size,height:size,borderRadius:9,border:"none",background:c.bg,color:c.txt,cursor:"pointer",
        display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.12s",...style}} {...rest}>
      <Icon size={iconSize} strokeWidth={2.1}/>
    </button>
  );
}

/* ═══════════════════════════════════════════
   INPUT / SELECT
═══════════════════════════════════════════ */
function Inp({label,error,icon:Icon,style,...props}) {
  const t=useTheme();
  const [f,setF]=useState(false);
  const handleChange=props.type==="number"&&props.onChange
    ? (e)=>{
        if(e.target.value.startsWith("-")){e.target.value=e.target.value.replace(/^-+/,"");}
        props.onChange(e);
      }
    : props.onChange;
  return (
    <label style={{display:"flex",flexDirection:"column",gap:5,fontSize:12.5,color:t.textMuted,fontFamily:FONT_BODY,fontWeight:500}}>
      {label}
      <span style={{position:"relative",display:"block"}}>
        {Icon&&<Icon size={15} strokeWidth={2} aria-hidden="true" style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:t.textFaint,pointerEvents:"none"}}/>}
        <input {...props} onChange={handleChange} min={props.type==="number"?(props.min??0):props.min}
          onFocus={e=>{setF(true);props.onFocus?.(e);}} onBlur={e=>{setF(false);props.onBlur?.(e);}}
          style={{background:t.surfaceSunken,border:`1px solid ${error?t.negative:f?t.accent:t.border}`,borderRadius:9,
            padding:Icon?"10px 12px 10px 34px":"10px 12px",color:t.text,fontSize:16,outline:"none",fontFamily:FONT_BODY,
            boxShadow:f?`0 0 0 3px ${t.focusRing}`:"none",transition:"all 0.15s",width:"100%",boxSizing:"border-box",minHeight:44,...(style||{})}} />
      </span>
      {error&&<span style={{color:t.negative,fontSize:11.5,display:"flex",alignItems:"center",gap:4}}><CircleAlert size={12}/>{error}</span>}
    </label>
  );
}

function Sel({label,children,style,...props}) {
  const t=useTheme();
  const [f,setF]=useState(false);
  return (
    <label style={{display:"flex",flexDirection:"column",gap:5,fontSize:12.5,color:t.textMuted,fontFamily:FONT_BODY,fontWeight:500}}>
      {label}
      <select {...props} onFocus={()=>setF(true)} onBlur={()=>setF(false)}
        style={{background:t.surfaceSunken,border:`1px solid ${f?t.accent:t.border}`,borderRadius:9,
          padding:"10px 12px",color:t.text,fontSize:16,outline:"none",fontFamily:FONT_BODY,minHeight:44,
          boxShadow:f?`0 0 0 3px ${t.focusRing}`:"none",transition:"all 0.15s",width:"100%",boxSizing:"border-box",...style}}>
        {children}
      </select>
    </label>
  );
}

/* ═══════════════════════════════════════════
   CATEGORY PICKER
═══════════════════════════════════════════ */
function CategoryPicker({label,value,onChange,customCategories,dispatch,style}) {
  const t=useTheme();
  const [adding,setAdding]=useState(false);
  const [newName,setNewName]=useState("");
  const [newDomain,setNewDomain]=useState("pc_part");

  const handleSelect=(e)=>{
    if(e.target.value==="__add__"){setAdding(true);return;}
    onChange(e.target.value);
  };

  const confirmAdd=()=>{
    const name=newName.trim();
    if(!name)return;
    dispatch({type:"ADD_CATEGORY",name,domain:newDomain});
    onChange(name);
    setAdding(false);setNewName("");setNewDomain("pc_part");
  };

  if(adding){
    return (
      <div style={{display:"flex",flexDirection:"column",gap:8,background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:10,...style}}>
        <div style={{fontSize:11.5,color:t.textMuted,fontWeight:600}}>New category</div>
        <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Webcam"
          style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:7,padding:"7px 9px",color:t.text,fontSize:13,fontFamily:FONT_BODY,outline:"none"}}/>
        <div style={{display:"flex",gap:6}}>
          {[["pc_part","PC Part"],["general","General Asset"]].map(([v,l])=>(
            <button key={v} type="button" onClick={()=>setNewDomain(v)} className="bl-focusable"
              style={{flex:1,padding:"6px 8px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:FONT_BODY,
                background:newDomain===v?t.accentSoft:t.surface,border:`1px solid ${newDomain===v?t.accentSoftBorder:t.border}`,color:newDomain===v?t.accent:t.textMuted}}>{l}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:6}}>
          <Btn small onClick={confirmAdd} style={{flex:1}}>Add</Btn>
          <Btn small variant="ghost" onClick={()=>{setAdding(false);setNewName("");}} style={{flex:1}}>Cancel</Btn>
        </div>
      </div>
    );
  }

  return (
    <Sel label={label} value={value} onChange={handleSelect} style={style}>
      {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
      {(customCategories||[]).map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
      <option value="__add__">+ Add category…</option>
    </Sel>
  );
}

/* ═══════════════════════════════════════════
   STAT BOX — small metric tile used in History's analytics grid
═══════════════════════════════════════════ */
function StatBox({label,value,sub,color}) {
  const t=useTheme();
  return (
    <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:12,padding:"13px 14px"}}>
      <div style={{fontSize:10.5,color:t.textMuted,fontWeight:600,marginBottom:5}}>{label}</div>
      <div style={{fontSize:16,fontWeight:700,fontFamily:FONT_MONO,color:color||t.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</div>
      {sub&&<div style={{fontSize:10.5,color:t.textFaint,marginTop:3}}>{sub}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SECTION HEADER — every card used to open with a stretched ALL-CAPS tracked
   label; that's the single default this redesign moves away from in favor of
   an icon + sentence-case title, which scans just as fast without shouting.
═══════════════════════════════════════════ */
function SectionHeader({icon:Icon,title,sub,action}){
  const t=useTheme();
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:sub?14:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
        {Icon&&<Icon size={16} strokeWidth={2} color={t.accent} style={{flexShrink:0}}/>}
        <div style={{minWidth:0}}>
          <div style={{fontSize:13.5,fontWeight:700,color:t.text,fontFamily:FONT_DISPLAY}}>{title}</div>
          {sub&&<div style={{fontSize:11.5,color:t.textFaint,marginTop:2}}>{sub}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

function PageHeader({title,sub,action}){
  const t=useTheme();
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
      <div>
        <h2 style={{color:t.text,fontSize:22,fontWeight:700,margin:0,fontFamily:FONT_DISPLAY,letterSpacing:"-0.01em"}}>{title}</h2>
        {sub&&<p style={{color:t.textMuted,fontSize:13,margin:"5px 0 0"}}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* ═══════════════════════════════════════════
   DEAL BAR — visual read on "market value vs. what you paid"
═══════════════════════════════════════════ */
function DealBar({score}) {
  const t=useTheme();
  const pctv=Math.min(100,Math.max(0,(score/2)*100));
  const tone=score>=1.3?t.positive:score>=1?t.info:t.negative;
  const verdict=score>=1.3?"Great deal":score>=1?"Fair deal":"Below market";
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,marginBottom:6}}>
        <span style={{color:tone,fontWeight:700}}>{verdict}</span>
        <span style={{color:t.textMuted,fontFamily:FONT_MONO}}>{score.toFixed(2)}×</span>
      </div>
      <div style={{height:6,background:t.surfaceSunken,borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pctv}%`,background:tone,borderRadius:99,transition:"width 0.6s cubic-bezier(0.34,1.2,0.64,1)"}}/>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SEGMENTED — reusable pill toggle (Buy's Bundle/Single, Sell's mode switch, etc.)
   so every mode toggle in the app shares one visual language instead of each
   screen inventing its own button-pair styling.
═══════════════════════════════════════════ */
function Segmented({options,value,onChange,ariaLabel}) {
  const t=useTheme();
  return (
    <div role="tablist" aria-label={ariaLabel} style={{display:"inline-flex",background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:10,padding:3,gap:2,flexWrap:"wrap"}}>
      {options.map(([k,l,Icon])=>(
        <button key={k} role="tab" aria-selected={value===k} onClick={()=>onChange(k)} className="bl-focusable" style={{
          padding:"9px 16px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",fontFamily:FONT_BODY,
          background:value===k?t.accentStrong:"transparent", color:value===k?t.accentContrast:t.textMuted,
          display:"inline-flex",alignItems:"center",gap:7,transition:"all 0.15s"}}>
          {Icon&&<Icon size={14} strokeWidth={2.25}/>}{l}
        </button>
      ))}
    </div>
  );
}
function HeroNumber({children,color}) {
  const t=useTheme();
  return (
    <span style={{
      background: color || (t.mode==="dark"?`linear-gradient(135deg,${t.text} 0%,${t.textMuted} 100%)`:`linear-gradient(135deg,${t.text} 0%,${t.textMuted} 100%)`),
      WebkitBackgroundClip:"text", backgroundClip:"text", color:"transparent",
      fontFamily:FONT_MONO, fontWeight:700, letterSpacing:"-0.02em",
    }}>{children}</span>
  );
}

function PeriodSwitch({period,setPeriod}) {
  const t=useTheme();
  const opts=[["month","This month"],["quarter","This quarter"],["all","All time"]];
  return (
    <div role="tablist" aria-label="Time period" style={{display:"inline-flex",background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:3,gap:2}}>
      {opts.map(([k,l])=>(
        <button key={k} role="tab" aria-selected={period===k} onClick={()=>setPeriod(k)} className="bl-focusable" style={{
          padding:"6px 12px",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer",border:"none",fontFamily:FONT_BODY,
          background:period===k?t.accentStrong:"transparent", color:period===k?t.accentContrast:t.textMuted,
          transition:"all 0.15s"}}>{l}</button>
      ))}
    </div>
  );
}

function KPICard({label,value,question,color,accent}) {
  const t=useTheme();
  return (
    <div style={{background:t.surface,border:`1px solid ${accent||t.border}`,borderRadius:14,padding:"16px 18px",minWidth:0}}>
      <div style={{fontSize:11.5,color:t.textMuted,fontWeight:600,marginBottom:8}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,fontFamily:FONT_MONO,color:color||t.text,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</div>
      {question&&<div style={{fontSize:11,color:t.textFaint,marginTop:7,lineHeight:1.4}}>{question}</div>}
    </div>
  );
}

function CapitalFlowDiagram({invested,inventoryVal,recovered,profit}) {
  const t=useTheme();
  const stages=[
    {label:"Cash in",sub:"capital deployed",value:invested,color:t.info},
    {label:"Inventory",sub:"held at market value",value:inventoryVal,color:t.accent},
    {label:"Sales",sub:"revenue collected",value:recovered,color:t.positive},
    {label:"Profit",sub:profit>=0?"net gain":"net loss",value:profit,color:profit>=0?t.positive:t.negative},
  ];
  return (
    <div style={{display:"flex",alignItems:"center",gap:0,overflowX:"auto",paddingBottom:4}}>
      {stages.map((s,i)=>(
        <Fragment key={s.label}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,minWidth:92,flexShrink:0}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:s.color,boxShadow:`0 0 0 3px ${s.color}22`}}/>
            <div style={{fontSize:14,fontWeight:700,fontFamily:FONT_MONO,color:t.text}}>{fmt(s.value)}</div>
            <div style={{fontSize:11.5,color:t.textMuted,fontWeight:600,textAlign:"center"}}>{s.label}</div>
            <div style={{fontSize:9.5,color:t.textFaint,textAlign:"center"}}>{s.sub}</div>
          </div>
          {i<stages.length-1&&(
            <svg width="36" height="10" style={{flexShrink:0,margin:"0 2px 28px"}} aria-hidden="true">
              <line x1="0" y1="5" x2="30" y2="5" stroke={t.border} strokeWidth="1.5"/>
              <polygon points="30,1 36,5 30,9" fill={t.border}/>
            </svg>
          )}
        </Fragment>
      ))}
    </div>
  );
}

function ProfitAreaChart({points,positive}) {
  const t=useTheme();
  if(points.length<2)return null;
  const max=Math.max(1,...points.map(Math.abs));
  const toXY=(v,i)=>{
    const x=(i/(points.length-1))*100;
    const y=32-(v/max)*28;
    return [x,y];
  };
  const linePath=points.map((v,i)=>{const [x,y]=toXY(v,i);return `${i===0?"M":"L"}${x.toFixed(2)},${y.toFixed(2)}`;}).join(" ");
  const [firstX]=toXY(points[0],0);
  const [lastX]=toXY(points[points.length-1],points.length-1);
  const areaPath=`M${firstX},32 ${linePath.replace(/^M/,"L")} L${lastX},32 Z`;
  const color=positive?t.positive:t.negative;
  const gradId=`pg-${positive?"pos":"neg"}-${t.mode}`;
  return (
    <svg viewBox="0 0 100 40" style={{width:"100%",height:96,display:"block"}} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {[8,16,24,32].map(y=>(
        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke={t.border} strokeWidth="0.4"/>
      ))}
      <path d={areaPath} fill={`url(#${gradId})`} stroke="none"/>
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}

function NetWorthHistoryChart({rows}) {
  const t=useTheme();
  if(!rows?.length)return null;
  if(rows.length===1){
    return <div style={{fontFamily:FONT_MONO,fontSize:17,fontWeight:700,color:t.text,padding:"16px 0 8px"}}>{fmt(rows[0].value)}</div>;
  }
  const values=rows.map(r=>Number(r.value||0));
  const min=Math.min(...values),max=Math.max(...values);
  const span=Math.max(1,max-min);
  const toXY=(v,i)=>{
    const x=(i/(rows.length-1))*100;
    const y=33-((v-min)/span)*27;
    return [x,y];
  };
  const path=rows.map((r,i)=>{const [x,y]=toXY(r.value,i);return `${i===0?"M":"L"}${x.toFixed(2)},${y.toFixed(2)}`;}).join(" ");
  const [fx]=toXY(values[0],0),[lx]=toXY(values[values.length-1],values.length-1);
  const area=`M${fx},33 ${path.replace(/^M/,"L")} L${lx},33 Z`;
  const trend=values[values.length-1]-values[0];
  const color=trend>=0?t.positive:t.negative;
  const gid=`nwh-${t.mode}`;
  return (
    <div>
      <svg viewBox="0 0 100 42" style={{width:"100%",height:112,display:"block"}} preserveAspectRatio="none" role="img" aria-label="Net worth history chart">
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.24"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
        {[7,14,21,28,35].map(y=><line key={y} x1="0" y1={y} x2="100" y2={y} stroke={t.border} strokeWidth="0.4"/>)}
        <path d={area} fill={`url(#${gid})`} stroke="none"/>
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke"/>
        {rows.map((r,i)=>{const [x,y]=toXY(r.value,i);return <circle key={r.key} cx={x} cy={y} r="1.6" fill={color}/>;})}
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",gap:8,marginTop:4}}>
        {rows.map(r=><div key={r.key} style={{fontSize:9.5,color:t.textFaint,textAlign:"center",flex:1,whiteSpace:"nowrap"}}>{r.label}</div>)}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}>
        <span style={{fontSize:11,color:t.textFaint}}>First → latest saved monthly value</span>
        <span style={{fontSize:12,fontFamily:FONT_MONO,fontWeight:700,color}}>{trend>=0?"+":"−"}{fmt(Math.abs(trend))}</span>
      </div>
    </div>
  );
}

function HealthScoreRing({score,tier}) {
  const t=useTheme();
  const r=42, c=2*Math.PI*r;
  const filled=(score/100)*c;
  return (
    <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
      <svg width="100" height="100" viewBox="0 0 100 100" style={{flexShrink:0}} role="img" aria-label={`Financial health score ${score} out of 100, rated ${tier.label}`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke={t.border} strokeWidth="8"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={tier.color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`} transform="rotate(-90 50 50)"
          style={{transition:"stroke-dasharray 0.8s cubic-bezier(0.34,1.2,0.64,1)"}}/>
        <text x="50" y="46" textAnchor="middle" fontSize="22" fontWeight="700" fill={t.text} fontFamily={FONT_MONO}>{score}</text>
        <text x="50" y="62" textAnchor="middle" fontSize="8" fill={t.textFaint}>/ 100</text>
      </svg>
      <div style={{flex:1,minWidth:160}}>
        <div style={{fontSize:15,fontWeight:700,color:tier.color,marginBottom:4}}>{tier.label}</div>
        <div style={{fontSize:12,color:t.textMuted,lineHeight:1.5}}>
          Composite of ROI, inventory turnover, cash position vs. baseline, and month-over-month profit momentum. A working diagnostic, not a credit score.
        </div>
      </div>
    </div>
  );
}

function SortHeader({label,active,dir,onClick,align}) {
  const t=useTheme();
  return (
    <th style={{padding:0,textAlign:align||"left"}}>
      <button onClick={onClick} className="bl-focusable" aria-sort={active?(dir==="asc"?"ascending":"descending"):"none"}
        style={{cursor:"pointer",textAlign:align||"left",padding:"10px",userSelect:"none",whiteSpace:"nowrap",
          background:"none",border:"none",width:"100%",display:"flex",alignItems:"center",gap:3,
          justifyContent:align==="right"?"flex-end":"flex-start",fontFamily:FONT_BODY}}>
        <span style={{fontSize:10.5,color:active?t.text:t.textMuted,fontWeight:700}}>{label}</span>
        {active&&(dir==="asc"?<ChevronUp size={12} color={t.text}/>:<ChevronDown size={12} color={t.text}/>)}
      </button>
    </th>
  );
}
function Dashboard({state,dispatch,toast,setTab,openLightbox}) {
  const t=useTheme();
  const [addingExpense,setAddingExpense]=useState(false);
  const [addingIncome,setAddingIncome]=useState(false);
  const [transferring,setTransferring]=useState(false);
  const [period,setPeriod]=useState("all"); // "month" | "quarter" | "all" — governs flow metrics only
  const [sortKey,setSortKey]=useState("date");
  const [sortDir,setSortDir]=useState("desc");
  const {parts,bundles,builds}=state;

  // Deleted sale records are kept (soft-delete, for History's filter) but must never count
  // toward live figures. Returned sales are excluded too — the money didn't stay made.
  const allSales=state.sales.filter(s=>!s.deleted&&!s.returned);

  const parseDate=(str)=>{ if(!str)return null; const d=new Date(str); return isNaN(d.getTime())?null:d; };
  const now=new Date();
  const inPeriod=(dateStr)=>{
    if(period==="all")return true;
    const d=parseDate(dateStr);
    if(!d)return true; // never silently hide a record just because its date didn't parse
    if(period==="month")return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();
    if(period==="quarter")return d.getFullYear()===now.getFullYear()&&Math.floor(d.getMonth()/3)===Math.floor(now.getMonth()/3);
    return true;
  };
  const sales=allSales.filter(s=>inPeriod(s.date)); // period-scoped — used for all flow metrics below

  // ── SNAPSHOT METRICS (always "as of now") ──────────────────────────────────────
  const activeInventory=parts.filter(p=>p.status==="available"||p.status==="in_build");
  const inventoryMarketValue=activeInventory.reduce((s,p)=>{const mkt=p.marketValue||0;return s+(mkt>0?mkt:p.allocatedCost);},0);
  const inventoryCost=activeInventory.reduce((s,p)=>s+p.allocatedCost,0);
  const cashOnHand=state.businessCash||0;
  const personalCash=state.personalCash||0;
  const outstandingReceivables=Number(state.outstandingReceivables||0);
  const totalDebt=Number(state.totalDebt||0);
  const netWorth=cashOnHand+inventoryMarketValue+outstandingReceivables-totalDebt;
  const netWorthSnapshots=Array.isArray(state.netWorthSnapshots)?state.netWorthSnapshots:[];

  // Last six calendar months, using the latest saved snapshot available in each month.
  const sixMonthNetWorthRows=Array.from({length:6},(_,idx)=>{
    const d=new Date(now.getFullYear(),now.getMonth()-(5-idx),1);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const monthSnaps=netWorthSnapshots
      .filter(s=>String(s.date||"").slice(0,7)===key)
      .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const latest=monthSnaps[monthSnaps.length-1];
    return {
      key,
      label:d.toLocaleDateString("en-PH",{month:"short",year:"numeric"}),
      value:latest?Number(latest.netWorth||0):null,
      date:latest?.date||null,
    };
  }).filter(r=>r.value!==null);
  const previousNetWorth=netWorthSnapshots
    .filter(s=>s.date!==localISODate())
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0]?.netWorth;
  const netWorthDailyChange=previousNetWorth!==undefined?netWorth-Number(previousNetWorth):null;
  const fundsToRecover=(state.expenses||[]).filter(e=>e.type==="personal_draw").reduce((s,e)=>s+e.amount,0);
  const isUnderCapital=cashOnHand<14500;
  const available=parts.filter(p=>p.status==="available").length;
  const inBuild=parts.filter(p=>p.status==="in_build").length;
  const soldCount=parts.filter(p=>p.status==="sold").length;
  const totalCapitalAllTime=parts.reduce((s,p)=>s+p.allocatedCost,0);
  const atRisk=parts.filter(p=>p.status!=="sold"&&p.status!=="defective").reduce((s,p)=>s+p.allocatedCost,0);
  const recoveredCostAllTime=parts.filter(p=>p.status==="sold").reduce((s,p)=>s+p.allocatedCost,0);
  const writeOffLoss=allSales.filter(s=>s.writeOff).reduce((s,x)=>s+Math.abs(x.profit),0);
  const writeOffCount=parts.filter(p=>p.status==="defective").length;

  const DEAD_DAYS=30;
  const deadInventory=parts.filter(p=>{
    if(p.status!=="available")return false;
    const bought=parseDate(p.history?.[0]?.date);
    if(!bought)return false;
    return Math.round((now-bought)/86400000)>DEAD_DAYS;
  });
  const deadInventoryValue=deadInventory.reduce((s,p)=>s+(p.marketValue||p.allocatedCost),0);

  // ── FLOW METRICS (respect the period switch) ───────────────────────────────────
  const invested=parts.filter(p=>{const d=parseDate(p.history?.[0]?.date);return d?inPeriod(p.history[0].date):period==="all";}).reduce((s,p)=>s+p.allocatedCost,0);
  const recovered=sales.reduce((s,x)=>s+x.salePrice,0);
  const periodCOGS=sales.reduce((s,x)=>s+x.cost,0);
  const totalProfit=recovered-periodCOGS;
  const roi=periodCOGS>0?totalProfit/periodCOGS:0;
  const inventoryTurnoverRate=inventoryCost>0?periodCOGS/inventoryCost:0;
  const avgProfitPerSale=sales.length?totalProfit/sales.length:0;
  const highestProfitSale=sales.length?[...sales].sort((a,b)=>b.profit-a.profit)[0]:null;

  // ── OPERATIONAL: avg days to sell (all-time — needs the full sample to be stable) ──
  const holdDurations=[];
  parts.filter(p=>p.status==="sold").forEach(p=>{
    const sale=allSales.find(s=>s.partId===p.id)||allSales.find(s=>s.name===p.name);
    const bought=p.history?.[0]?.date;
    if(sale&&bought){
      const d1=parseDate(bought),d2=parseDate(sale.date);
      if(d1&&d2)holdDurations.push(Math.max(0,Math.round((d2-d1)/86400000)));
    }
  });
  const avgDaysToSell=holdDurations.length?Math.round(holdDurations.reduce((s,d)=>s+d,0)/holdDurations.length):null;

  // ── MONTH-OVER-MONTH (always all-time source data — "Best Month Ever" can't be period-scoped) ──
  const monthMap={};
  allSales.forEach(s=>{
    const d=parseDate(s.date); if(!d)return;
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if(!monthMap[key])monthMap[key]={label:d.toLocaleDateString("en-PH",{month:"short",year:"numeric"}),profit:0,sortKey:key};
    monthMap[key].profit+=s.profit;
  });
  const monthRows=Object.values(monthMap).sort((a,b)=>a.sortKey.localeCompare(b.sortKey));
  const thisMonthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const lastMonthDate=new Date(now.getFullYear(),now.getMonth()-1,1);
  const lastMonthKey=`${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth()+1).padStart(2,"0")}`;
  const thisMonthProfit=monthMap[thisMonthKey]?.profit||0;
  const lastMonthProfit=monthMap[lastMonthKey]?.profit||0;
  const momGrowthPct=lastMonthProfit!==0?(thisMonthProfit-lastMonthProfit)/Math.abs(lastMonthProfit):(thisMonthProfit>0?1:0);
  const bestMonth=monthRows.length?monthRows.reduce((a,b)=>b.profit>a.profit?b:a):null;

  // ── Profit trend chart data (period-scoped, running cumulative across the period's sales) ──
  let running=0;
  const cumPoints=sales.map(s=>{running+=s.profit;return running;});

  // ── Profit by category (period-scoped) ──
  const categoryProfit={};
  sales.forEach(s=>{
    const part=parts.find(p=>p.name===s.name);
    const cat=part?.category||"Other";
    if(!categoryProfit[cat])categoryProfit[cat]={profit:0,count:0};
    categoryProfit[cat].profit+=s.profit;
    categoryProfit[cat].count+=1;
  });
  const categoryRows=Object.entries(categoryProfit).sort((a,b)=>b[1].profit-a[1].profit);
  const maxCatProfit=Math.max(1,...categoryRows.map(([,v])=>Math.abs(v.profit)));

  // ── CFO Insights — every line is derived from a real number above, never invented ──
  const insights=[];
  if(categoryRows.length>0){
    const [topCat,topVal]=categoryRows[0];
    const posTotal=categoryRows.reduce((s,[,v])=>s+Math.max(v.profit,0),0)||1;
    const share=Math.round(Math.max(topVal.profit,0)/posTotal*100);
    if(topVal.profit>0)insights.push(`${topCat} generates ${share}% of total profit — your strongest category.`);
  }
  if(avgDaysToSell!==null)insights.push(`Average sale completes in ${avgDaysToSell} day${avgDaysToSell===1?"":"s"} from purchase to sale.`);
  if(parts.length>0){
    const avgCost=totalCapitalAllTime/parts.length;
    if(avgCost>0&&cashOnHand>0){
      const buyingPower=Math.floor(cashOnHand/avgCost);
      if(buyingPower>0)insights.push(`Current cash position supports ${buyingPower} more purchase${buyingPower===1?"":"s"} at your average part cost of ${fmt(Math.round(avgCost))}.`);
    }
  }
  if(lastMonthProfit!==0)insights.push(`Profit ${momGrowthPct>=0?"increased":"decreased"} ${pct(Math.abs(momGrowthPct))} vs. last month.`);
  if(deadInventory.length>0)insights.push(`${deadInventory.length} item${deadInventory.length===1?"":"s"} worth ${fmt(deadInventoryValue)} has sat unsold for over ${DEAD_DAYS} days.`);
  if(insights.length===0)insights.push("Record a few sales to unlock CFO-level insights on category performance, cash runway, and momentum.");

  // ── Financial Health Score (0–100), weighted composite ──
  const roiScore=Math.max(0,Math.min(roi/0.5,1));
  const turnoverScore=Math.max(0,Math.min(inventoryTurnoverRate/2,1));
  const cashScore=Math.max(0,Math.min(cashOnHand/14500,1));
  const growthScore=Math.max(0,Math.min((momGrowthPct+0.5)/1,1));
  const healthScore=Math.round(roiScore*25+turnoverScore*25+cashScore*25+growthScore*25);
  const healthTier=healthScore>=90?{label:"Excellent",color:t.positive}
    :healthScore>=70?{label:"Good",color:t.warning}
    :{label:"Needs attention",color:t.negative};

  // ── Recent transactions table (period-scoped, sortable) ──
  const getDaysHeld=(sale)=>{
    let boughtStr=null;
    if(sale.partId){
      boughtStr=parts.find(p=>p.id===sale.partId)?.history?.[0]?.date;
    } else if(sale.buildId){
      const build=builds.find(b=>b.id===sale.buildId);
      const buildParts=build?parts.filter(p=>build.partIds.includes(p.id)):[];
      const dates=buildParts.map(p=>parseDate(p.history?.[0]?.date)).filter(Boolean);
      if(dates.length)boughtStr=new Date(Math.min(...dates)).toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"});
    }
    if(!boughtStr)boughtStr=parts.find(p=>p.name===sale.name)?.history?.[0]?.date;
    const d1=parseDate(boughtStr),d2=parseDate(sale.date);
    return d1&&d2?Math.max(0,Math.round((d2-d1)/86400000)):null;
  };
  const txRows=sales.map(s=>({
    id:s.id,name:s.name,cost:s.cost,salePrice:s.salePrice,profit:s.profit,
    roi:s.cost>0?s.profit/s.cost:0,days:getDaysHeld(s),date:s.date,
  }));
  const sortedTx=[...txRows].sort((a,b)=>{
    let av=a[sortKey],bv=b[sortKey];
    if(sortKey==="name"){av=av||"";bv=bv||"";return sortDir==="asc"?av.localeCompare(bv):bv.localeCompare(av);}
    if(sortKey==="date"){av=parseDate(av)?.getTime()||0;bv=parseDate(bv)?.getTime()||0;}
    else{av=av??-Infinity;bv=bv??-Infinity;}
    return sortDir==="asc"?av-bv:bv-av;
  }).slice(0,12);
  const toggleSort=(key)=>{
    if(sortKey===key)setSortDir(d=>d==="asc"?"desc":"asc");
    else{setSortKey(key);setSortDir("desc");}
  };

  const periodLabel=period==="month"?"this month":period==="quarter"?"this quarter":"all time";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      {addingExpense&&<AddExpenseModal dispatch={dispatch} toast={toast} onClose={()=>setAddingExpense(false)}/>}
      {addingIncome&&<AddIncomeModal dispatch={dispatch} toast={toast} onClose={()=>setAddingIncome(false)}/>}
      {transferring&&<TransferModal dispatch={dispatch} toast={toast} onClose={()=>setTransferring(false)} businessCash={cashOnHand} personalCash={personalCash}/>}

      {/* Header */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <PageHeader title="Business overview" sub={`Flow figures shown for ${periodLabel} · balances as of today`}
          action={
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn small variant="ghost" icon={ArrowLeftRight} onClick={()=>setTransferring(true)}>Transfer</Btn>
              <Btn small variant="ghost" icon={Plus} onClick={()=>setAddingIncome(true)}>Income</Btn>
              <Btn small variant="ghost" icon={Minus} onClick={()=>setAddingExpense(true)}>Expense</Btn>
            </div>
          }/>
        <PeriodSwitch period={period} setPeriod={setPeriod}/>
      </div>

      {/* Net Worth Hero */}
      <div style={{background:t.mode==="dark"?`linear-gradient(155deg,${t.surface} 0%,${t.surfaceSunken} 100%)`:`linear-gradient(155deg,${t.surface} 0%,${t.bg} 100%)`,
        border:`1px solid ${t.border}`,borderRadius:16,padding:"24px 24px"}}>
        <div style={{fontSize:12,color:t.textMuted,fontWeight:600,marginBottom:9}}>Total business net worth</div>
        <div style={{fontSize:40,lineHeight:1}}><HeroNumber><AnimNum value={netWorth}/></HeroNumber></div>
        <div style={{fontSize:12,color:t.textFaint,marginTop:11}}>Business cash ({fmt(cashOnHand)}) + inventory at market value ({fmt(inventoryMarketValue)}) + receivables ({fmt(outstandingReceivables)}) − debt ({fmt(totalDebt)}) · excludes personal wallet</div>
        {netWorthDailyChange!==null&&(
          <div style={{fontSize:11.5,color:netWorthDailyChange>=0?t.positive:t.negative,marginTop:8,fontFamily:FONT_MONO,fontWeight:600}}>
            {netWorthDailyChange>=0?"▲":"▼"} {fmt(Math.abs(netWorthDailyChange))} vs. previous saved snapshot
          </div>
        )}
      </div>

      {/* Historical net-worth snapshots */}
      <Card>
        <SectionHeader icon={TrendingUp} title="Net worth history" sub="Saved financial snapshots — latest value captured for each calendar month" action={
          <div style={{fontFamily:FONT_MONO,fontSize:12,color:t.textMuted}}>{netWorthSnapshots.length} snapshot{netWorthSnapshots.length===1?"":"s"}</div>
        }/>
        {sixMonthNetWorthRows.length>=2
          ? <NetWorthHistoryChart rows={sixMonthNetWorthRows}/>
          : <div style={{padding:"18px 0 6px",textAlign:"center",fontSize:12.5,color:t.textFaint}}>
              Your financial history starts with today’s baseline. Keep using the app and this chart will build automatically day by day.
            </div>}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:14,marginTop:16,paddingTop:14,borderTop:`1px solid ${t.border}`}}>
          <div><div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Current net worth</div><div style={{fontSize:15,fontWeight:700,fontFamily:FONT_MONO,color:t.text}}>{fmt(netWorth)}</div></div>
          <div><div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Saved snapshots</div><div style={{fontSize:15,fontWeight:700,fontFamily:FONT_MONO,color:t.info}}>{netWorthSnapshots.length}</div></div>
          <div><div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Latest snapshot</div><div style={{fontSize:15,fontWeight:700,fontFamily:FONT_MONO,color:t.text}}>{netWorthSnapshots.length?netWorthSnapshots[netWorthSnapshots.length-1].date:"—"}</div></div>
        </div>
      </Card>

      {/* KPI Row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:10}}>
        <KPICard label="Available cash" value={fmt(cashOnHand)} color={isUnderCapital?t.negative:t.info} accent={isUnderCapital?t.negativeSoftBorder:undefined}
          question="Ready to deploy on new inventory"/>
        <KPICard label="Inventory value" value={fmt(inventoryMarketValue)} color={t.accent}
          question="Current market value if sold today"/>
        <KPICard label="Total profit" value={`${totalProfit>=0?"+":""}${fmt(totalProfit)}`} color={totalProfit>=0?t.positive:t.negative}
          question={`Net earnings, ${periodLabel}`}/>
        <KPICard label="ROI" value={pct(roi)} color={roi>=0?t.positive:t.negative}
          question={`Return on capital sold, ${periodLabel}`}/>
      </div>

      {/* ── Group: Capital & cash ── */}
      <div style={{display:"flex",flexDirection:"column",gap:14,marginTop:10}}>
        <Card>
          <SectionHeader icon={Boxes} title="Business capital overview" sub="Where all-time capital actually sits right now"/>
          {(()=>{
            const maxVal=Math.max(totalCapitalAllTime,atRisk,recoveredCostAllTime,1);
            const barH=v=>Math.max(4,Math.round((v/maxVal)*120));
            const bars=[
              {label:"Deployed",sub:"ever spent buying",value:totalCapitalAllTime,color:t.info},
              {label:"Locked",sub:"sitting unsold",value:atRisk,color:t.warning},
              {label:"Recovered",sub:"cost basis of sold items",value:recoveredCostAllTime,color:t.positive},
            ];
            const lockedRatio=totalCapitalAllTime>0?atRisk/totalCapitalAllTime:0;
            return (
              <>
                <div style={{display:"flex",justifyContent:"space-around",alignItems:"flex-end",height:150,marginBottom:8}}>
                  {bars.map(b=>(
                    <div key={b.label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,width:"30%"}}>
                      <div style={{fontSize:12,fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(b.value)}</div>
                      <div style={{width:"100%",maxWidth:64,height:barH(b.value),background:b.color,borderRadius:"6px 6px 2px 2px",
                        transition:"height 0.6s cubic-bezier(0.34,1.2,0.64,1)"}}/>
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",justifyContent:"space-around",marginBottom:lockedRatio>0.5?12:0}}>
                  {bars.map(b=>(
                    <div key={b.label} style={{width:"30%",textAlign:"center"}}>
                      <div style={{fontSize:11.5,color:t.textMuted,fontWeight:600}}>{b.label}</div>
                      <div style={{fontSize:10,color:t.textFaint}}>{b.sub}</div>
                    </div>
                  ))}
                </div>
                {lockedRatio>0.5&&(
                  <div style={{background:t.warningSoft,border:`1px solid ${t.warningSoftBorder}`,borderRadius:9,padding:"10px 12px",fontSize:12,color:t.warning,display:"flex",gap:8,alignItems:"flex-start"}}>
                    <AlertTriangle size={14} style={{flexShrink:0,marginTop:1}}/>
                    <span>{pct(lockedRatio)} of everything ever spent is still sitting unsold — consider moving inventory to free up cash.</span>
                  </div>
                )}
              </>
            );
          })()}
        </Card>

        <Card>
          <SectionHeader icon={Banknote} title="Cash flow" sub={`Capital cycle, ${periodLabel}`}/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:12,marginBottom:18}}>
            <div><div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Money invested</div><div style={{fontSize:15,fontWeight:700,color:t.info,fontFamily:FONT_MONO}}>{fmt(invested)}</div></div>
            <div><div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Money recovered</div><div style={{fontSize:15,fontWeight:700,color:t.positive,fontFamily:FONT_MONO}}>{fmt(recovered)}</div></div>
            <div><div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Net profit</div><div style={{fontSize:15,fontWeight:700,color:totalProfit>=0?t.positive:t.negative,fontFamily:FONT_MONO}}>{totalProfit>=0?"+":""}{fmt(totalProfit)}</div></div>
            <div><div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Cash position</div><div style={{fontSize:15,fontWeight:700,color:t.text,fontFamily:FONT_MONO}}>{fmt(cashOnHand)}</div></div>
          </div>
          <CapitalFlowDiagram invested={invested} inventoryVal={inventoryMarketValue} recovered={recovered} profit={totalProfit}/>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:18,paddingTop:16,borderTop:`1px solid ${t.border}`}}>
            <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:12}}>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Personal wallet</div>
              <div style={{fontSize:15,fontWeight:700,color:t.text,fontFamily:FONT_MONO}}>{fmt(personalCash)}</div>
              <div style={{fontSize:10,color:t.textFaint,marginTop:3}}>owner's pocket money — not business capital</div>
            </div>
            <div style={{background:fundsToRecover>0?t.warningSoft:t.surfaceSunken,border:`1px solid ${fundsToRecover>0?t.warningSoftBorder:t.border}`,borderRadius:9,padding:12}}>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Funds to recover</div>
              <div style={{fontSize:15,fontWeight:700,color:fundsToRecover>0?t.warning:t.textFaint,fontFamily:FONT_MONO}}>{fmt(fundsToRecover)}</div>
              <div style={{fontSize:10,color:t.textFaint,marginTop:3}}>lifetime personal draws from the business</div>
            </div>
          </div>

          {isUnderCapital&&(
            <div style={{background:t.negativeSoft,border:`1px solid ${t.negativeSoftBorder}`,borderRadius:9,padding:12,marginTop:14}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:9}}>
                <AlertTriangle size={16} color={t.negative} style={{flexShrink:0,marginTop:1}}/>
                <div style={{color:t.textMuted,fontSize:12.5,lineHeight:1.5}}>
                  <strong style={{color:t.negative}}>Below target baseline.</strong> Cash on hand ({fmt(cashOnHand)}) is under the ₱14,500 war chest. Consider pausing purchases or raising prices until it recovers.
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Group: Inventory & performance ── */}
      <div style={{display:"flex",flexDirection:"column",gap:14,marginTop:14}}>
        <Card>
          <SectionHeader icon={Boxes} title="Inventory intelligence" sub="How efficiently stock is moving, as of today"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:14}}>
            {[
              ["Available",available,t.positive,"ready to sell or build"],
              ["In builds",inBuild,t.info,"allocated to active builds"],
              ["Sold",soldCount,t.textMuted,"lifetime units moved"],
              ["Avg. days to sell",avgDaysToSell!==null?`${avgDaysToSell}d`:"—",t.accent,"purchase to sale, all-time"],
              ["Turnover rate",`${inventoryTurnoverRate.toFixed(2)}×`,t.info,`cost of goods sold ÷ current stock cost, ${periodLabel}`],
              ["Cash conversion",avgDaysToSell!==null?`~${avgDaysToSell}d`:"—",t.accent,"≈ days to sell — cash purchases, cash sales"],
            ].map(([l,v,c,sub])=>(
              <div key={l}>
                <div style={{fontSize:19,fontWeight:700,fontFamily:FONT_MONO,color:c}}>{v}</div>
                <div style={{fontSize:11,color:t.text,fontWeight:600,marginTop:4}}>{l}</div>
                <div style={{fontSize:10,color:t.textFaint,marginTop:2,lineHeight:1.35}}>{sub}</div>
              </div>
            ))}
          </div>
          {deadInventory.length>0&&(
            <div style={{background:t.warningSoft,border:`1px solid ${t.warningSoftBorder}`,borderRadius:9,padding:"11px 12px",marginTop:16}}>
              <div style={{color:t.warning,fontWeight:700,fontSize:12.5,marginBottom:3,display:"flex",alignItems:"center",gap:6}}><AlertTriangle size={13}/>Dead inventory — {deadInventory.length} item{deadInventory.length===1?"":"s"} unsold {DEAD_DAYS}+ days</div>
              <div style={{color:t.textMuted,fontSize:12}}>{fmt(deadInventoryValue)} in market value sitting idle. Consider a price cut or bundling to move it.</div>
            </div>
          )}
          {writeOffCount>0&&(
            <div style={{fontSize:11.5,color:t.textFaint,marginTop:14,paddingTop:12,borderTop:`1px solid ${t.border}`}}>
              {writeOffCount} write-off{writeOffCount===1?"":"s"} recorded · <span style={{color:t.negative,fontFamily:FONT_MONO}}>{fmt(-writeOffLoss)}</span> lifetime loss
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader icon={TrendingUp} title="Profit analytics"
            sub={`Running profit across ${sales.length} sale${sales.length===1?"":"s"} in the selected period`}
            action={<div style={{fontSize:12,color:totalProfit>=0?t.positive:t.negative,fontFamily:FONT_MONO,fontWeight:600}}>{totalProfit>=0?"+":""}{fmt(totalProfit)}</div>}/>
          {cumPoints.length>1
            ? <ProfitAreaChart points={cumPoints} positive={totalProfit>=0}/>
            : <div style={{fontSize:12.5,color:t.textFaint,padding:"20px 0",textAlign:"center"}}>Need at least 2 sales in this period to plot a trend.</div>}

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:14,marginTop:20,paddingTop:16,borderTop:`1px solid ${t.border}`}}>
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Monthly profit</div>
              <div style={{fontSize:16,fontWeight:700,color:thisMonthProfit>=0?t.positive:t.negative,fontFamily:FONT_MONO}}>{thisMonthProfit>=0?"+":""}{fmt(thisMonthProfit)}</div>
              <div style={{fontSize:10,color:t.textFaint,marginTop:3}}>current calendar month, always</div>
            </div>
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Best month ever</div>
              <div style={{fontSize:16,fontWeight:700,color:t.positive,fontFamily:FONT_MONO}}>{bestMonth?fmt(bestMonth.profit):"—"}</div>
              <div style={{fontSize:10,color:t.textFaint,marginTop:3}}>{bestMonth?bestMonth.label:"not enough data yet"}</div>
            </div>
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Avg. profit / sale</div>
              <div style={{fontSize:16,fontWeight:700,color:avgProfitPerSale>=0?t.positive:t.negative,fontFamily:FONT_MONO}}>{sales.length?`${avgProfitPerSale>=0?"+":""}${fmt(Math.round(avgProfitPerSale))}`:"—"}</div>
              <div style={{fontSize:10,color:t.textFaint,marginTop:3}}>{periodLabel}</div>
            </div>
            <div>
              <div style={{fontSize:11,color:t.textMuted,marginBottom:3}}>Highest profit sale</div>
              <div style={{fontSize:16,fontWeight:700,color:t.positive,fontFamily:FONT_MONO}}>{highestProfitSale?`+${fmt(highestProfitSale.profit)}`:"—"}</div>
              <div style={{fontSize:10,color:t.textFaint,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{highestProfitSale?highestProfitSale.name:periodLabel}</div>
            </div>
          </div>
        </Card>

        {categoryRows.length>0&&(
          <Card>
            <SectionHeader icon={Tag} title="Profit by category" sub={`Which categories are actually worth buying, ${periodLabel}`}/>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {categoryRows.map(([cat,v])=>{
                const w=Math.abs(v.profit)/maxCatProfit*100;
                const positive=v.profit>=0;
                return (
                  <div key={cat}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                      <span style={{fontSize:12.5,color:t.text}}>{cat} <span style={{color:t.textFaint}}>({v.count} sold)</span></span>
                      <span style={{fontSize:12.5,fontFamily:FONT_MONO,fontWeight:700,color:positive?t.positive:t.negative}}>{positive?"+":""}{fmt(v.profit)}</span>
                    </div>
                    <div style={{height:5,background:t.surfaceSunken,borderRadius:99}}>
                      <div style={{height:"100%",width:`${w}%`,background:positive?t.positive:t.negative,borderRadius:99,transition:"width 0.7s cubic-bezier(0.34,1.2,0.64,1)"}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        <Card>
          <SectionHeader icon={Sparkles} title="Financial health score"/>
          <HealthScoreRing score={healthScore} tier={healthTier}/>
        </Card>
      </div>

      {/* ── Group: Insights & activity ── */}
      <div style={{display:"flex",flexDirection:"column",gap:14,marginTop:14}}>
        <Card style={{background:t.mode==="dark"?`linear-gradient(155deg,${t.accentSoft} 0%,${t.surface} 60%)`:`linear-gradient(155deg,${t.accentSoft} 0%,${t.surface} 60%)`,border:`1px solid ${t.accentSoftBorder}`}}>
          <SectionHeader icon={Sparkles} title="CFO insights"/>
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            {insights.slice(0,5).map((line,i)=>(
              <div key={i} style={{display:"flex",gap:9,alignItems:"flex-start"}}>
                <ArrowRight size={13} color={t.accent} style={{flexShrink:0,marginTop:3}}/>
                <span style={{fontSize:13,color:t.text,lineHeight:1.55}}>{line}</span>
              </div>
            ))}
          </div>
        </Card>

        {sortedTx.length>0&&(
          <Card style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"16px 18px 6px"}}>
              <SectionHeader icon={ClipboardList} title="Recent transactions" sub={`${periodLabel} · tap a column to sort`}/>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:520}}>
                <thead>
                  <tr style={{borderBottom:`1px solid ${t.border}`}}>
                    <SortHeader label="Product" active={sortKey==="name"} dir={sortDir} onClick={()=>toggleSort("name")}/>
                    <SortHeader label="Buy" active={sortKey==="cost"} dir={sortDir} onClick={()=>toggleSort("cost")} align="right"/>
                    <SortHeader label="Sale" active={sortKey==="salePrice"} dir={sortDir} onClick={()=>toggleSort("salePrice")} align="right"/>
                    <SortHeader label="Profit" active={sortKey==="profit"} dir={sortDir} onClick={()=>toggleSort("profit")} align="right"/>
                    <SortHeader label="ROI" active={sortKey==="roi"} dir={sortDir} onClick={()=>toggleSort("roi")} align="right"/>
                    <SortHeader label="Held" active={sortKey==="days"} dir={sortDir} onClick={()=>toggleSort("days")} align="right"/>
                  </tr>
                </thead>
                <tbody>
                  {sortedTx.map(r=>(
                    <tr key={r.id} style={{borderBottom:`1px solid ${t.border}`}}>
                      <td style={{padding:"10px",color:t.text,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</td>
                      <td style={{padding:"10px",textAlign:"right",color:t.textMuted,fontFamily:FONT_MONO}}>{fmt(r.cost)}</td>
                      <td style={{padding:"10px",textAlign:"right",color:t.text,fontFamily:FONT_MONO}}>{fmt(r.salePrice)}</td>
                      <td style={{padding:"10px",textAlign:"right",color:r.profit>=0?t.positive:t.negative,fontFamily:FONT_MONO,fontWeight:700}}>{r.profit>=0?"+":""}{fmt(r.profit)}</td>
                      <td style={{padding:"10px",textAlign:"right",color:r.roi>=0?t.positive:t.negative,fontFamily:FONT_MONO}}>{pct(r.roi)}</td>
                      <td style={{padding:"10px",textAlign:"right",color:t.textFaint,fontFamily:FONT_MONO}}>{r.days!==null?`${r.days}d`:"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {bundles.length>0&&(()=>{
          const bundlePnl=bundles.map(b=>{
            const bParts=parts.filter(p=>p.bundleId===b.id);
            const soldParts=bParts.filter(p=>p.status==="sold");
            const unsoldParts=bParts.filter(p=>p.status!=="sold");
            const recoveredAmt=soldParts.reduce((s,p)=>{
              const sale=allSales.find(s=>s.partId===p.id)||allSales.find(s=>s.name===p.name);
              return s+(sale?sale.salePrice:0);
            },0);
            const unsoldMarket=unsoldParts.reduce((s,p)=>s+p.marketValue,0);
            return {...b,bParts,soldParts,unsoldParts,recoveredAmt,unsoldMarket};
          });
          return (
            <Card>
              <SectionHeader icon={PackageCheck} title="Bundle recovery"/>
              <div style={{display:"flex",flexDirection:"column",gap:13}}>
                {bundlePnl.map(b=>{
                  const recPct=b.purchasePrice>0?Math.min(b.recoveredAmt/b.purchasePrice*100,100):0;
                  return (
                    <div key={b.id}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                        <span style={{fontSize:13,color:t.text,fontWeight:500}}>{b.name}</span>
                        <span style={{fontSize:12,color:t.textFaint,fontFamily:FONT_MONO}}>{fmt(b.recoveredAmt)} / {fmt(b.purchasePrice)}</span>
                      </div>
                      <div style={{height:5,background:t.surfaceSunken,borderRadius:99}}>
                        <div style={{height:"100%",width:`${recPct}%`,background:recPct>=100?t.positive:t.accent,borderRadius:99,transition:"width 0.8s ease"}}/>
                      </div>
                      <div style={{fontSize:10.5,color:t.textFaint,marginTop:4}}>
                        {b.soldParts.length}/{b.bParts.length} parts sold · {b.unsoldParts.length} remaining ~{fmt(b.unsoldMarket)} market
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })()}

        {(state.quickNotes||[]).length>0&&(
          <Card>
            <SectionHeader icon={StickyNote} title="Quick notes"/>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[...state.quickNotes].reverse().map(n=>(
                <div key={n.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,
                  background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:"10px 12px"}}>
                  <div style={{minWidth:0}}>
                    <div style={{color:t.text,fontSize:13,lineHeight:1.45,whiteSpace:"pre-wrap"}}>{n.text}</div>
                    <div style={{color:t.textFaint,fontSize:10.5,marginTop:5}}>{n.date}</div>
                  </div>
                  <IconBtn icon={X} label="Delete note" size={30} iconSize={14} onClick={()=>dispatch({type:"DELETE_QUICK_NOTE",id:n.id})}/>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {parts.length===0&&(
        <Card style={{textAlign:"center",padding:48}}>
          <Monitor size={40} strokeWidth={1.5} color={t.textFaint} style={{marginBottom:14}}/>
          <div style={{color:t.text,fontWeight:600,fontFamily:FONT_DISPLAY}}>No parts yet</div>
          <div style={{color:t.textFaint,fontSize:13,marginTop:6}}>Go to Buy → add your first bundle.</div>
          <div style={{marginTop:18}}><Btn onClick={()=>setTab("Buy")}>Start buying</Btn></div>
        </Card>
      )}
    </div>
  );
}
/* ═══════════════════════════════════════════
   DEFECTIVE MODAL
═══════════════════════════════════════════ */
function DefectiveModal({part,onConfirm,onCancel}) {
  const t=useTheme();
  const [reason,setReason]=useState("");
  return (
    <ModalShell onClose={onCancel} label="Mark as defective">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:8,fontFamily:FONT_DISPLAY}}>Mark as defective?</div>
      <div style={{fontSize:13,color:t.textMuted,marginBottom:14,lineHeight:1.55}}>
        "{part.name}" will be removed from active inventory and logged as a capital loss of <b style={{color:t.negative}}>{fmt(part.allocatedCost)}</b> on your Dashboard.
      </div>
      <Inp label="Reason (optional)" value={reason} onChange={e=>setReason(e.target.value)} placeholder="DOA, shorted during build, etc."/>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16}}>
        <Btn variant="warn" icon={AlertTriangle} onClick={()=>onConfirm(reason)} style={{width:"100%"}}>Mark defective — log loss</Btn>
        <Btn variant="ghost" onClick={onCancel} style={{width:"100%"}}>Cancel</Btn>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   QUICK SELL MODAL
═══════════════════════════════════════════ */
function QuickSellModal({part,onClose,onConfirm,targetMargin}) {
  const t=useTheme();
  const suggested = Math.round(part.allocatedCost * (1 + targetMargin/100));
  const [price,setPrice]=useState(String(suggested));
  const [buyer,setBuyer]=useState("");
  const sp=parseFloat(price)||0;
  const profit=sp-part.allocatedCost;
  const m=part.allocatedCost>0?profit/part.allocatedCost:0;
  return (
    <ModalShell onClose={onClose} label="Quick sell">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:4,fontFamily:FONT_DISPLAY}}>Quick sell</div>
      <div style={{fontSize:13,color:t.textFaint,marginBottom:16}}>{part.name} · cost {fmt(part.allocatedCost)}</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <Inp label={`Sale price (₱) — suggested ${fmt(suggested)} at ${targetMargin}% margin`} type="number" value={price} onChange={e=>setPrice(e.target.value)} />
        <Inp label="Buyer name (optional)" value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="Juan dela Cruz" />
        {sp>0&&(
          <div style={{background:t.surfaceSunken,borderRadius:9,padding:12,border:`1px solid ${t.border}`}}>
            {[["Profit",`${profit>=0?"+":""}${fmt(profit)}`,profit>=0?t.positive:t.negative],
              ["Margin",pct(m),profit>=0?t.positive:t.negative]].map(([l,v,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                <span style={{color:t.textMuted}}>{l}</span>
                <span style={{fontFamily:FONT_MONO,fontWeight:700,color:c}}>{v}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn variant="success" icon={Check} onClick={()=>onConfirm(sp,buyer)} disabled={!sp} style={{flex:1}}>Confirm sale</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   EDIT PART MODAL
═══════════════════════════════════════════ */
function EditPartModal({part,onClose,onSave,dispatch,customCategories}) {
  const t=useTheme();
  const [name,setName]=useState(part.name);
  const [cat,setCat]=useState(part.category);
  const [cost,setCost]=useState(String(part.allocatedCost));
  const [market,setMarket]=useState(String(part.marketValue));
  const [notes,setNotes]=useState(part.notes||"");
  const [photo,setPhoto]=useState({photoUrl:part.photoUrl||"",photoRecordId:part.photoRecordId||""});
  return (
    <ModalShell onClose={onClose} label="Edit part" maxWidth={420}>
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:16,fontFamily:FONT_DISPLAY}}>Edit part</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <PhotoUpload label="Photo" photoUrl={photo.photoUrl} photoRecordId={photo.photoRecordId} onChange={setPhoto}/>
        <Inp label="Name" value={name} onChange={e=>setName(e.target.value)}/>
        <CategoryPicker label="Category" value={cat} onChange={setCat} customCategories={customCategories} dispatch={dispatch}/>
        <div className="responsive-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <Inp label="Cost (₱)" type="number" value={cost} onChange={e=>setCost(e.target.value)}/>
          <Inp label="Market value (₱)" type="number" value={market} onChange={e=>setMarket(e.target.value)}/>
        </div>
        <Inp label="Notes (condition, extras, etc.)" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Tested working, fan slightly loud"/>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn onClick={()=>onSave({name,category:cat,allocatedCost:parseFloat(cost)||part.allocatedCost,marketValue:parseFloat(market)||part.marketValue,notes,photoUrl:photo.photoUrl,photoRecordId:photo.photoRecordId},`cost→${fmt(parseFloat(cost)||part.allocatedCost)}`)} style={{flex:1}}>Save changes</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </ModalShell>
  );
}
function TransferModal({onClose, dispatch, toast, businessCash, personalCash}) {
  const t=useTheme();
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("to_personal");

  const handleTransfer = () => {
    const amt = parseFloat(amount);
    if(!amt || amt <= 0) return toast("Enter a valid amount", "error");
    if(direction === "to_personal" && amt > businessCash) return toast("Insufficient business funds", "error");
    if(direction === "to_business" && amt > personalCash) return toast("Insufficient personal funds", "error");

    dispatch({type: "TRANSFER_FUNDS", amount: amt, direction});
    toast(`Transferred ${fmt(amt)} to ${direction === "to_personal" ? "personal wallet" : "business wallet"}`);
    onClose();
  };

  return (
    <ModalShell onClose={onClose} label="Transfer funds">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:16,fontFamily:FONT_DISPLAY}}>Transfer funds</div>
      <Segmented ariaLabel="Direction" value={direction} onChange={setDirection} options={[["to_personal","To personal",User],["to_business","To business",Wallet]]}/>
      <div style={{marginTop:12}}>
        <Inp label="Amount (₱)" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" />
      </div>
      <div style={{marginTop:16, display:"flex", gap:8}}>
        <Btn variant="success" icon={ArrowLeftRight} onClick={handleTransfer} style={{flex:1}}>Confirm transfer</Btn>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      </div>
    </ModalShell>
  );
}
function Buy({state,dispatch,toast}) {
  const t=useTheme();
  const [mode,setMode]=useState("bundle");
  const [bundleName,setBundleName]=useState("");
  const [purchasePrice,setPurchasePrice]=useState("");
  const [bundlePhoto,setBundlePhoto]=useState({photoUrl:"",photoRecordId:""});
  // Smart default: start each new row on whatever category was bought last, instead of
  // always resetting to GPU — most buying sessions are one category at a time (a batch of
  // RAM, a batch of PSUs), so this saves a re-pick almost every time.
  const [lastCategory,setLastCategory]=usePersistentState("pctrader:lastCategory","GPU");
  const [partRows,setPartRows]=useState([{id:uid(),name:"",category:lastCategory,marketValue:"",notes:"",photoUrl:"",photoRecordId:""}]);
  const [singleName,setSingleName]=useState("");
  const [singleCat,setSingleCat]=useState(lastCategory);
  const [singleCost,setSingleCost]=useState("");
  const [singleMarket,setSingleMarket]=useState("");
  const [singleQty,setSingleQty]=useState("1");
  const [singleNotes,setSingleNotes]=useState("");
  const [singlePhoto,setSinglePhoto]=useState({photoUrl:"",photoRecordId:""});
  const [loading,setLoading]=useState(false);
  const lastRowMarketRef=useRef(null);

  const totalMarket=partRows.reduce((s,r)=>s+(parseFloat(r.marketValue)||0),0);
  const paid=parseFloat(purchasePrice)||0;
  const dealScore=paid>0&&totalMarket>0?totalMarket/paid:null;

  const addRow=()=>{
    setPartRows(p=>[...p,{id:uid(),name:"",category:p[p.length-1]?.category||lastCategory,marketValue:"",notes:"",photoUrl:"",photoRecordId:""}]);
    // Focus lands on the new row's name field once it exists in the DOM.
    requestAnimationFrame(()=>{
      const inputs=document.querySelectorAll('[data-buy-row-name="1"]');
      inputs[inputs.length-1]?.focus();
    });
  };
  const removeRow=id=>setPartRows(p=>p.filter(r=>r.id!==id));
  const updateRow=(id,field,val)=>setPartRows(p=>p.map(r=>r.id===id?{...r,[field]:val}:r));
  // Fewer clicks: Enter in the last row's market-value field adds the next row directly,
  // so a whole bundle can be entered without reaching for the mouse.
  const handleLastRowKeyDown=e=>{
    if(e.key==="Enter"){e.preventDefault();addRow();}
  };

  // Speed feature: duplicate the most recent bundle's structure (names/categories) so
  // re-buying a similar batch doesn't mean re-typing everything from scratch.
  const analyzeBundlePhoto=useCallback(async(dataUrl)=>{
    const result=await analyzeBuyImage(dataUrl,{mode:"bundle",existingRows:partRows});
    if(result.source) setBundleName(result.source);
    if(result.purchasePrice) setPurchasePrice(String(result.purchasePrice));
    if(result.parts.length){
      setPartRows(prev=>result.parts.map((p,i)=>({
        id:prev[i]?.id||uid(),
        name:p.name||prev[i]?.name||"",
        category:p.category||prev[i]?.category||lastCategory,
        marketValue:p.marketValue||prev[i]?.marketValue||"",
        notes:p.notes||prev[i]?.notes||"",
        photoUrl:prev[i]?.photoUrl||"",
        photoRecordId:prev[i]?.photoRecordId||"",
      })));
      const last=result.parts[result.parts.length-1];
      if(last?.category) setLastCategory(last.category);
      toast(`AI identified ${result.parts.length} part${result.parts.length===1?"":"s"} from the bundle photo`,"success");
    }else{
      toast("AI could not confidently identify the bundle parts — review the photo and enter them manually","warn");
    }
    return result;
  },[partRows,setLastCategory,toast]);

  const analyzeSinglePhoto=useCallback(async(dataUrl)=>{
    const result=await analyzeBuyImage(dataUrl,{mode:"single"});
    if(result.name) setSingleName(result.name);
    if(result.category) setSingleCat(result.category);
    if(result.notes) setSingleNotes(result.notes);
    if(result.marketValue) setSingleMarket(String(result.marketValue));
    if(result.quantity>1) setSingleQty(String(result.quantity));
    if(result.category) setLastCategory(result.category);
    toast(result.name?`AI identified ${result.name}`:"AI analyzed the photo — please review the fields", "success");
    return result;
  },[setLastCategory,toast]);

  const analyzeRowPhoto=useCallback((rowId)=>(dataUrl)=>analyzeBuyImage(dataUrl,{mode:"single"}).then(result=>{
    if(result.name) updateRow(rowId,"name",result.name);
    if(result.category) updateRow(rowId,"category",result.category);
    if(result.notes) updateRow(rowId,"notes",result.notes);
    if(result.marketValue) updateRow(rowId,"marketValue",String(result.marketValue));
    return result;
  }),[]);

  const duplicateLastBundle=()=>{
    const last=state.bundles[state.bundles.length-1];
    if(!last)return;
    const lastParts=state.parts.filter(p=>p.bundleId===last.id);
    setBundleName(last.name);
    setPartRows(lastParts.length?lastParts.map(p=>({id:uid(),name:p.name,category:p.category,marketValue:"",notes:"",photoUrl:"",photoRecordId:""})):[{id:uid(),name:"",category:lastCategory,marketValue:"",notes:"",photoUrl:"",photoRecordId:""}]);
    toast(`Loaded structure from "${last.name}" — update prices`);
  };

  const submitBundle=()=>{
    if(!bundleName||!purchasePrice||totalMarket===0){toast("Fill all fields and add part values","error");return;}
    setLoading(true);
    setTimeout(()=>{
      const bundleId=uid();
      const num=state.bundles.length+1;
      const src=`Bundle #${String(num).padStart(3,"0")} — ${bundleName}`;
      const newParts=partRows.filter(r=>r.name&&r.marketValue).map(r=>{
        const mv=parseFloat(r.marketValue);
        const share=mv/totalMarket;
        const alloc=share*paid;
        return {id:uid(),name:r.name,category:r.category,marketValue:mv,allocatedCost:alloc,
          source:src,bundleId,status:"available",notes:r.notes||"",soldTo:"",
          photoUrl:r.photoUrl||"",photoRecordId:r.photoRecordId||"",
          history:[{date:today(),event:`Bought via ${src} — allocated ${fmt(alloc)}`}]};
      });
      dispatch({type:"ADD_BUNDLE",bundle:{id:bundleId,name:bundleName,purchasePrice:paid,totalMarket,date:today(),
        photoUrl:bundlePhoto.photoUrl,photoRecordId:bundlePhoto.photoRecordId},parts:newParts});
      toast(`Bundle added — ${newParts.length} parts in inventory`);
      if(newParts.length)setLastCategory(newParts[newParts.length-1].category);
      setBundleName("");setPurchasePrice("");setPartRows([{id:uid(),name:"",category:newParts.length?newParts[newParts.length-1].category:lastCategory,marketValue:"",notes:"",photoUrl:"",photoRecordId:""}]);
      setBundlePhoto({photoUrl:"",photoRecordId:""});
      setLoading(false);
    },400);
  };

  const submitSingle=()=>{
    if(!singleName||!singleCost){toast("Enter name and cost","error");return;}
    setLoading(true);
    setTimeout(()=>{
      const cost=parseFloat(singleCost);
      const market=parseFloat(singleMarket)||cost;
      const qty=Math.max(1,parseInt(singleQty,10)||1);
      // Quantity creates N independent part records (each with its own id/status/history) rather
      // than a shared "count" field — every other part of the app (Inventory, Builds picker, Sell,
      // History) already works in terms of one trackable item per status, so N separate records is
      // what lets each unit be individually put in a build, sold, or marked defective on its own.
      const newParts=Array.from({length:qty},()=>({
        id:uid(),name:singleName,category:singleCat,marketValue:market,
        allocatedCost:cost,source:"Direct purchase",bundleId:null,status:"available",notes:singleNotes,soldTo:"",
        photoUrl:singlePhoto.photoUrl,photoRecordId:singlePhoto.photoRecordId,
        history:[{date:today(),event:`Bought for ${fmt(cost)}`}]}));
      dispatch({type:"ADD_PARTS",parts:newParts});
      toast(qty>1?`${qty}× ${singleName} added`:`${singleName} added`);
      setLastCategory(singleCat);
      setSingleName("");setSingleCost("");setSingleMarket("");setSingleQty("1");setSingleNotes("");
      setSinglePhoto({photoUrl:"",photoRecordId:""});
      setLoading(false);
    },300);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <PageHeader title="Buy parts" sub="Add a bundle PC or an individual part."/>
      <Segmented ariaLabel="Purchase type" value={mode} onChange={setMode} options={[["bundle","Bundle PC",Boxes],["single","Single part",Cpu]]}/>

      {mode==="bundle"&&(
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:10,flexWrap:"wrap"}}>
            <div style={{fontWeight:700,fontSize:13.5,color:t.text,fontFamily:FONT_DISPLAY}}>Bundle details</div>
            {state.bundles.length>0&&(
              <Btn small variant="ghost" icon={Copy} onClick={duplicateLastBundle}>Duplicate last bundle</Btn>
            )}
          </div>
          <div style={{marginBottom:16}}>
            <PhotoUpload label="Bundle photo (optional)" photoUrl={bundlePhoto.photoUrl} photoRecordId={bundlePhoto.photoRecordId} onChange={setBundlePhoto} onAnalyze={analyzeBundlePhoto}/>
          </div>
          <div className="responsive-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
            <Inp label="Source / seller" value={bundleName} onChange={e=>setBundleName(e.target.value)} placeholder="FB Marketplace – Juan"/>
            <Inp label="You paid (₱)" type="number" value={purchasePrice} onChange={e=>setPurchasePrice(e.target.value)} placeholder="8000"/>
          </div>
          <div style={{fontWeight:700,fontSize:13,color:t.text,marginBottom:12,fontFamily:FONT_DISPLAY}}>Parts — enter estimated market value</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {partRows.map((row,idx)=>(
              <div key={row.id} style={{display:"flex",gap:10,alignItems:"flex-start",animation:"blFadeUp 0.15s ease",paddingBottom:14,borderBottom:idx<partRows.length-1?`1px solid ${t.border}`:"none"}}>
                <PhotoUpload label="" photoUrl={row.photoUrl} photoRecordId={row.photoRecordId} onChange={({photoUrl,photoRecordId})=>{updateRow(row.id,"photoUrl",photoUrl);updateRow(row.id,"photoRecordId",photoRecordId);}} onAnalyze={analyzeRowPhoto(row.id)}/>
                <div className="part-row" style={{display:"grid",gridTemplateColumns:"1fr auto 90px 90px auto",gap:8,alignItems:"end",flex:1}}>
                  <Inp label={idx===0?"Part name":""} value={row.name} onChange={e=>updateRow(row.id,"name",e.target.value)} placeholder="RX 580" data-buy-row-name="1"/>
                  <CategoryPicker label={idx===0?"Category":"​"} value={row.category} onChange={v=>updateRow(row.id,"category",v)} customCategories={state.customCategories} dispatch={dispatch} style={{minWidth:90}}/>
                  <Inp label={idx===0?"Market (₱)":""} type="number" value={row.marketValue} onChange={e=>updateRow(row.id,"marketValue",e.target.value)} placeholder="4000"
                    onKeyDown={idx===partRows.length-1?handleLastRowKeyDown:undefined}/>
                  <Inp label={idx===0?"Notes":""} value={row.notes||""} onChange={e=>updateRow(row.id,"notes",e.target.value)} placeholder="condition"/>
                  <IconBtn icon={Trash2} label={`Remove ${row.name||"part row"}`} variant="danger" onClick={()=>removeRow(row.id)} style={{alignSelf:idx===0?"end":"start",marginBottom:idx===0?2:0}}/>
                </div>
              </div>
            ))}
          </div>
          <div style={{marginTop:12}}><Btn small variant="ghost" icon={Plus} onClick={addRow}>Add part <span style={{opacity:0.6,fontWeight:400}}>(or press Enter in Market)</span></Btn></div>

          {dealScore!==null&&(
            <div style={{marginTop:16,background:t.surfaceSunken,borderRadius:10,padding:14,border:`1px solid ${t.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                <span style={{color:t.textMuted}}>Market value</span><span style={{fontFamily:FONT_MONO,color:t.text}}>{fmt(totalMarket)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:10}}>
                <span style={{color:t.textMuted}}>You pay</span><span style={{fontFamily:FONT_MONO,color:t.text}}>{fmt(paid)}</span>
              </div>
              <DealBar score={dealScore}/>
              <div style={{marginTop:12,borderTop:`1px solid ${t.border}`,paddingTop:10}}>
                {partRows.filter(r=>r.name&&r.marketValue).map(r=>{
                  const mv=parseFloat(r.marketValue)||0;
                  const share=totalMarket>0?mv/totalMarket:0;
                  return <div key={r.id} style={{display:"flex",justifyContent:"space-between",fontSize:11.5,marginBottom:4}}>
                    <span style={{color:t.textFaint}}>{r.name} ({pct(share)})</span>
                    <span style={{fontFamily:FONT_MONO,color:t.textMuted}}>{fmt(share*paid)}</span>
                  </div>;
                })}
              </div>
            </div>
          )}
          <div style={{marginTop:16}}><Btn loading={loading} onClick={submitBundle} disabled={!bundleName||!purchasePrice||totalMarket===0} style={{width:"100%"}}>Add bundle to inventory</Btn></div>
        </Card>
      )}

      {mode==="single"&&(
        <Card>
          <div style={{fontWeight:700,fontSize:13.5,color:t.text,marginBottom:16,fontFamily:FONT_DISPLAY}}>Single part</div>
          <div style={{marginBottom:16}}>
            <PhotoUpload label="Photo (optional)" photoUrl={singlePhoto.photoUrl} photoRecordId={singlePhoto.photoRecordId} onChange={setSinglePhoto} onAnalyze={analyzeSinglePhoto}/>
          </div>
          <div className="responsive-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Inp label="Part name" value={singleName} onChange={e=>setSingleName(e.target.value)} placeholder="GTX 1060 6GB"/>
            <CategoryPicker label="Category" value={singleCat} onChange={setSingleCat} customCategories={state.customCategories} dispatch={dispatch}/>
            <Inp label="Cost (₱, per unit)" type="number" value={singleCost} onChange={e=>setSingleCost(e.target.value)} placeholder="3000"/>
            <Inp label="Market value (₱, per unit, optional)" type="number" value={singleMarket} onChange={e=>setSingleMarket(e.target.value)} placeholder="3500"/>
            <Inp label="Quantity" type="number" min="1" value={singleQty} onChange={e=>setSingleQty(e.target.value)} placeholder="1"/>
          </div>
          {parseInt(singleQty,10)>1&&singleCost&&(
            <div style={{marginTop:12,background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:"10px 12px",
              display:"flex",justifyContent:"space-between",fontSize:12}}>
              <span style={{color:t.textMuted}}>{Math.max(1,parseInt(singleQty,10)||1)} units × {fmt(parseFloat(singleCost)||0)}</span>
              <span style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt((Math.max(1,parseInt(singleQty,10)||1))*(parseFloat(singleCost)||0))} total</span>
            </div>
          )}
          <div style={{marginTop:14}}>
            <Inp label="Notes — condition, extras, observations" value={singleNotes} onChange={e=>setSingleNotes(e.target.value)} placeholder="Tested working. Includes original box."/>
          </div>
          <div style={{marginTop:16}}><Btn loading={loading} onClick={submitSingle} disabled={!singleName||!singleCost} style={{width:"100%"}}>{parseInt(singleQty,10)>1?`Add ${Math.max(1,parseInt(singleQty,10)||1)} to inventory`:"Add to inventory"}</Btn></div>
        </Card>
      )}
    </div>
  );
}
function PartDetailSheet({part,buildName,onClose,openLightbox,onQuickSell,onEdit,onDefective,onDelete,onDuplicate,onAddToBuild,onGoToBuild}) {
  const t=useTheme();
  const potential=part.marketValue-part.allocatedCost;
  return (
    <ModalShell onClose={onClose} label={part.name} sheet maxWidth={520} padding={0}>
      <div style={{width:"100%",aspectRatio:"16/10",background:t.surfaceSunken,display:"flex",alignItems:"center",justifyContent:"center",
        borderBottom:`1px solid ${t.border}`}}>
        {part.photoUrl?(
          <button onClick={()=>openLightbox(part.photoUrl)} aria-label="View photo full-screen" className="bl-focusable"
            style={{width:"100%",height:"100%",border:"none",padding:0,background:"none",cursor:"pointer"}}>
            <img src={part.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          </button>
        ):(
          <Wrench size={40} strokeWidth={1.5} color={t.textFaint}/>
        )}
      </div>

      <div style={{padding:"18px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:14}}>
          <div style={{color:t.text,fontWeight:700,fontSize:19,fontFamily:FONT_DISPLAY}}>{part.name}</div>
          <StatusBadge s={part.status}/>
        </div>

        <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:t.textMuted,marginBottom:10}}>Purchase details</div>
          {[["Bought",fmt(part.allocatedCost),t.text],["Market value",fmt(part.marketValue),t.text],
            ["Potential profit",`${potential>=0?"+":""}${fmt(potential)}`,potential>=0?t.positive:t.negative]
          ].map(([l,v,c],i)=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:i<2?7:0,paddingTop:i===2?8:0,borderTop:i===2?`1px solid ${t.border}`:"none"}}>
              <span style={{color:t.textMuted}}>{l}</span>
              <span style={{fontFamily:FONT_MONO,fontWeight:i===2?700:600,color:c}}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
          <DetailRow label="Category" value={part.category}/>
          <DetailRow label="Purchase source" value={part.source}/>
          {part.history?.[0]?.date&&<DetailRow label="Purchase date" value={part.history[0].date}/>}
          {buildName&&<DetailRow label="Status" value={`Used in ${buildName}`} valueColor={t.info}/>}
          {part.soldTo&&<DetailRow label="Sold to" value={part.soldTo}/>}
          {part.notes&&<DetailRow label="Notes" value={part.notes}/>}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {part.status==="available"&&(
            <div style={{display:"flex",gap:8}}>
              <Btn variant="success" icon={Zap} onClick={onQuickSell} style={{flex:1}}>Quick sell</Btn>
              <Btn variant="ghost" icon={Wrench} onClick={onAddToBuild} style={{flex:1}}>Add to build</Btn>
            </div>
          )}
          <div style={{display:"flex",gap:8}}>
            <Btn variant="ghost" icon={Pencil} onClick={onEdit} style={{flex:1}}>Edit</Btn>
            <Btn variant="ghost" icon={ClipboardCopy} onClick={onDuplicate} style={{flex:1}}>Duplicate</Btn>
          </div>
          {part.status==="in_build"?(
            <div style={{marginTop:6,paddingTop:14,borderTop:`1px solid ${t.border}`}}>
              <div style={{fontSize:12,color:t.textMuted,lineHeight:1.5,marginBottom:8}}>
                This part is used in <strong style={{color:t.info}}>{buildName}</strong>. Dissolve that build first to free it up before editing its defective/delete status here.
              </div>
              <Btn variant="ghost" icon={Wrench} onClick={onGoToBuild} style={{width:"100%"}}>Go to {buildName}</Btn>
            </div>
          ):(
            <div style={{display:"flex",gap:8,marginTop:6,paddingTop:14,borderTop:`1px solid ${t.border}`}}>
              {part.status!=="sold"&&part.status!=="defective"&&(
                <Btn variant="warn" icon={AlertTriangle} onClick={onDefective} style={{flex:1}}>Mark defective</Btn>
              )}
              <Btn variant="danger" icon={Trash2} onClick={onDelete} style={{flex:1}}>Delete</Btn>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function DetailRow({label,value,valueColor}) {
  const t=useTheme();
  return (
    <div>
      <div style={{fontSize:11,color:t.textFaint,marginBottom:2}}>{label}</div>
      <div style={{fontSize:13,color:valueColor||t.text}}>{value}</div>
    </div>
  );
}

function PartGroupSheet({group,onClose,onViewUnit}) {
  const t=useTheme();
  const p=group[0];
  const count=group.length;
  const totalCost=p.allocatedCost*count;
  const totalMarket=p.marketValue*count;
  return (
    <ModalShell onClose={onClose} label={`${p.name} — ${count} units`} sheet maxWidth={520} padding={0}>
      <div style={{padding:"6px 20px 20px"}}>
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16}}>
          <PhotoThumb url={p.photoUrl} size={52} seed={p.id.length}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:t.text,fontWeight:700,fontSize:16,fontFamily:FONT_DISPLAY}}>{p.name}</div>
            <div style={{color:t.textMuted,fontSize:12,marginTop:2}}>{p.category} · {count} identical units</div>
          </div>
          <StatusBadge s={p.status}/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
          <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:11}}>
            <div style={{fontSize:10.5,color:t.textMuted,fontWeight:600}}>Cost each</div>
            <div style={{fontSize:14,fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(p.allocatedCost)}</div>
            <div style={{fontSize:10.5,color:t.textFaint,marginTop:2}}>Total {fmt(totalCost)}</div>
          </div>
          <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:11}}>
            <div style={{fontSize:10.5,color:t.textMuted,fontWeight:600}}>Market each</div>
            <div style={{fontSize:14,fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(p.marketValue)}</div>
            <div style={{fontSize:10.5,color:t.textFaint,marginTop:2}}>Total {fmt(totalMarket)}</div>
          </div>
        </div>

        <div style={{fontSize:12,color:t.textMuted,fontWeight:600,marginBottom:10}}>
          Individual units — select one to sell, edit, or mark it defective
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {group.map((unit,i)=>(
            <button key={unit.id} onClick={()=>onViewUnit(unit)} className="bl-focusable" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 11px",
              borderRadius:9,background:t.surfaceSunken,border:`1px solid ${t.border}`,cursor:"pointer",transition:"border-color 0.15s",width:"100%",textAlign:"left",fontFamily:FONT_BODY}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=t.borderStrong;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;}}>
              <span style={{color:t.textFaint,fontSize:11,fontFamily:FONT_MONO,width:20,flexShrink:0}}>{i+1}</span>
              <PhotoThumb url={unit.photoUrl} size={28} seed={unit.id.length}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:t.text,fontSize:12.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {unit.notes?unit.notes:`Unit ${i+1}`}
                </div>
              </div>
              <ChevronRight size={16} color={t.textFaint}/>
            </button>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
function Inventory({state,dispatch,toast,setTab,openLightbox,jumpRequest}) {
  const t=useTheme();
  const [statusFilter,setStatusFilter]=useState("all");
  const [catFilter,setCatFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [viewing,setViewing]=useState(null); // part shown in the detail sheet
  const [viewingGroup,setViewingGroup]=useState(null); // group of identical parts shown in the group sheet
  const [bundleView,setBundleView]=useState(false);
  const [quickSell,setQuickSell]=useState(null);
  const [editing,setEditing]=useState(null);
  const [deleting,setDeleting]=useState(null); // part pending delete confirmation
  // Global search deep-links here: arriving with a query clears any stale filters so the
  // result the person tapped is actually visible, not hidden behind a leftover status filter.
  useEffect(()=>{
    if(jumpRequest){
      setSearch(jumpRequest.query);
      setStatusFilter("all");
      setCatFilter("all");
      setBundleView(false);
    }
  },[jumpRequest]);
  const [defectiveTarget,setDefectiveTarget]=useState(null); // part pending defective confirmation
  const {parts,settings,builds,bundles}=state;

  // Look up which build (by name) a part currently belongs to, for the "Used in Build X" status line
  const buildNameFor=p=>{
    if(p.status!=="in_build")return null;
    const b=builds.find(b=>!b.dissolved&&b.partIds.includes(p.id));
    return b?b.name:null;
  };

  const categoriesPresent=[...new Set(parts.map(p=>p.category))];

  const filtered=parts.filter(p=>{
    if(statusFilter!=="all"&&p.status!==statusFilter)return false;
    if(catFilter!=="all"&&p.category!==catFilter)return false;
    if(search&&!p.name.toLowerCase().includes(search.toLowerCase())&&!p.category.toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  // Restocking the same item (e.g. buying 20 identical power cables) still creates 20
  // independently-trackable part records under the hood — each can still be sold, built, or
  // marked defective on its own. This only changes how they're DISPLAYED: identical parts
  // (same name, category, cost, market value, and status) collapse into a single card with a
  // quantity badge, instead of cluttering the grid with 20 near-identical cards. Anything
  // that's the only one of its kind renders exactly as a normal single card, unchanged.
  const groupKey=p=>`${p.name}|${p.category}|${Math.round(p.allocatedCost)}|${Math.round(p.marketValue)}|${p.status}`;
  const groupMap=new Map();
  filtered.forEach(p=>{
    const k=groupKey(p);
    if(!groupMap.has(k))groupMap.set(k,[]);
    groupMap.get(k).push(p);
  });
  const groupedCards=[...groupMap.values()]; // each entry is an array of 1+ identical parts

  const handleQuickSell=(sp,buyer)=>{
    if(!quickSell)return;
    const p=quickSell;
    const sale={id:uid(),partId:p.id,name:p.name,cost:p.allocatedCost,salePrice:sp,profit:sp-p.allocatedCost,buyerName:buyer,date:today()};
    dispatch({type:"SELL",mode:"part",id:p.id,sale});
    toast(`${p.name} sold for ${fmt(sp)} — profit ${fmt(sp-p.allocatedCost)}`,sp-p.allocatedCost>=0?"success":"warn");
    setQuickSell(null);setViewing(null);
  };

  const handleEdit=(changes,desc)=>{
    dispatch({type:"UPDATE_PART",id:editing.id,changes,desc});
    toast(`${editing.name} updated`);
    setEditing(null);
  };

  const confirmDelete=()=>{
    if(deleting._isBundle)return; // handled by the dual-choice modal instead
    if(deleting.status==="in_build"){
      toast(`Can't delete — "${deleting.name}" is still in a build. Dissolve that build first.`,"error");
      setDeleting(null);return;
    }
    dispatch({type:"DELETE_PART",id:deleting.id});
    toast(`${deleting.name} deleted`,"warn");
    setDeleting(null);setViewing(null);
  };

  const deleteBundleWithParts=()=>{
    dispatch({type:"DELETE_BUNDLE",bundleId:deleting.id,mode:"parts-too"});
    toast(`"${deleting.name}" and its parts deleted`,"warn");
    setDeleting(null);
  };

  const deleteBundleKeepParts=()=>{
    dispatch({type:"DELETE_BUNDLE",bundleId:deleting.id,mode:"keep-loose"});
    toast(`"${deleting.name}" removed — parts kept as loose inventory`,"warn");
    setDeleting(null);
  };

  const confirmDefective=(reason)=>{
    dispatch({type:"MARK_DEFECTIVE",id:defectiveTarget.id,reason});
    toast(`${defectiveTarget.name} marked defective — logged as a loss`,"warn");
    setDefectiveTarget(null);setViewing(null);
  };

  const duplicatePart=(p)=>{
    dispatch({type:"DUPLICATE_PART",id:p.id});
    toast(`Duplicated ${p.name}`);
    setViewing(null);
  };

  const goAddToBuild=()=>{
    setViewing(null);
    toast("Pick this part (and any others) on the Builds tab to assemble a PC");
    setTab("Builds");
  };

  const goToBuild=()=>{
    setViewing(null);
    toast("Find this build on the Builds tab to dissolve it");
    setTab("Builds");
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {quickSell&&<QuickSellModal part={quickSell} onClose={()=>setQuickSell(null)} onConfirm={handleQuickSell} targetMargin={settings?.targetMargin||30}/>}
      {editing&&<EditPartModal part={editing} onClose={()=>setEditing(null)} onSave={handleEdit} dispatch={dispatch} customCategories={state.customCategories}/>}
      {deleting&&!deleting._isBundle&&(
        <ConfirmModal title="Delete this part?" message={`"${deleting.name}" will be permanently removed. This can't be undone.`}
          onConfirm={confirmDelete} onCancel={()=>setDeleting(null)}/>
      )}
      {deleting&&deleting._isBundle&&(
        <ConfirmModal title="Delete this bundle?" message={`What should happen to the parts that came from "${deleting.name}"? Most of the time you want to keep them as loose inventory.`}
          onCancel={()=>setDeleting(null)}
          extraChoices={[
            {label:"Delete bundle, keep parts as loose inventory (recommended)",onClick:deleteBundleKeepParts,variant:"success"},
            {label:"Delete bundle AND permanently destroy its parts",onClick:deleteBundleWithParts,variant:"danger"},
          ]}/>
      )}
      {defectiveTarget&&(
        <DefectiveModal part={defectiveTarget} onConfirm={confirmDefective} onCancel={()=>setDefectiveTarget(null)}/>
      )}
      {viewingGroup&&(
        <PartGroupSheet group={viewingGroup} onClose={()=>setViewingGroup(null)}
          onViewUnit={(unit)=>{setViewing(unit);setViewingGroup(null);}}/>
      )}
      {viewing&&(
        <PartDetailSheet part={viewing} buildName={buildNameFor(viewing)} onClose={()=>setViewing(null)}
          openLightbox={openLightbox}
          onQuickSell={()=>{setQuickSell(viewing);setViewing(null);}}
          onEdit={()=>{setEditing(viewing);setViewing(null);}}
          onDefective={()=>{setDefectiveTarget(viewing);setViewing(null);}}
          onDelete={()=>{setDeleting(viewing);setViewing(null);}}
          onDuplicate={()=>duplicatePart(viewing)}
          onAddToBuild={goAddToBuild}
          onGoToBuild={goToBuild}/>
      )}

      <PageHeader title="Inventory" sub={`${parts.length} part${parts.length===1?"":"s"} tracked`}/>

      <Inp value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or category…" icon={Search} aria-label="Search inventory"/>

      {categoriesPresent.length>0&&(
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <Btn small variant={catFilter==="all"?"primary":"ghost"} onClick={()=>setCatFilter("all")}>All categories</Btn>
          {categoriesPresent.map(c=>(
            <Btn key={c} small variant={catFilter===c?"primary":"ghost"} onClick={()=>setCatFilter(c)}>{c}</Btn>
          ))}
        </div>
      )}

      <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
        {["all","available","in_build","sold","defective"].map(f=>{
          const active=!bundleView&&statusFilter===f;
          return (
            <Btn key={f} small variant={active?"primary":"ghost"} onClick={()=>{setStatusFilter(f);setBundleView(false);}}>
              {f==="all"?"All":f.replace("_"," ")}
              <span style={{background:active?"rgba(255,255,255,0.22)":(t.mode==="dark"?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.06)"),borderRadius:99,padding:"1px 6px",fontSize:10.5,marginLeft:2}}>
                {f==="all"?parts.length:parts.filter(p=>p.status===f).length}
              </span>
            </Btn>
          );
        })}
        <Btn small variant={bundleView?"primary":"ghost"} icon={Boxes} onClick={()=>setBundleView(true)}>Bundles</Btn>
      </div>

      {bundleView?(
        bundles.length===0?(
          <Card style={{textAlign:"center",padding:36}}><div style={{color:t.textFaint}}>No bundles yet.</div></Card>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {bundles.map((b,i)=>{
              const bParts=parts.filter(p=>p.bundleId===b.id);
              return (
                <Card key={b.id} style={{animation:`blFadeUp 0.2s ease ${i*0.03}s both`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:12}}>
                    <div style={{display:"flex",gap:11,minWidth:0}}>
                      {b.photoUrl&&<PhotoThumb url={b.photoUrl} size={56} seed={i} onClick={()=>openLightbox(b.photoUrl)} label={`View photo of ${b.name}`}/>}
                      <div>
                        <div style={{color:t.text,fontWeight:700,fontSize:14,fontFamily:FONT_DISPLAY}}>{b.name}</div>
                        <div style={{color:t.textMuted,fontSize:11.5,marginTop:2}}>{b.date} · {bParts.length} parts · paid {fmt(b.purchasePrice)}</div>
                      </div>
                    </div>
                    <IconBtn icon={Trash2} label={`Delete bundle ${b.name}`} variant="danger" onClick={()=>setDeleting({...b,_isBundle:true})}/>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:4,borderTop:`1px solid ${t.border}`,paddingTop:10}}>
                    {bParts.map(p=>(
                      <button key={p.id} onClick={()=>setViewing(p)} className="bl-focusable" style={{display:"flex",alignItems:"center",gap:9,fontSize:12,
                        cursor:"pointer",background:"none",border:"none",padding:"6px 4px",borderRadius:7,width:"100%",textAlign:"left",fontFamily:FONT_BODY}}
                        onMouseEnter={e=>e.currentTarget.style.background=t.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="none"}>
                        <PhotoThumb url={p.photoUrl} size={32} seed={p.id.length}/>
                        <span style={{color:t.text,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                        <span style={{color:t.textFaint,fontSize:10.5}}>{p.category}</span>
                        <StatusBadge s={p.status}/>
                        <span style={{fontFamily:FONT_MONO,color:t.textMuted,fontSize:11}}>{fmt(p.allocatedCost)}</span>
                      </button>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )
      ):filtered.length===0?(
        <Card style={{textAlign:"center",padding:36}}>
          <PackageX size={28} strokeWidth={1.5} color={t.textFaint} style={{marginBottom:10}}/>
          <div style={{color:t.textFaint}}>{search?"No parts match your search.":"No parts here yet."}</div>
        </Card>
      ):(
        /* Marketplace-style card grid — replaces the old always-expanded list so scanning
           50-100+ parts is fast, with full detail only a tap away. Column count now scales
           with available width instead of being frozen at 2, so it uses desktop space. */
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
          {groupedCards.map((group,i)=>{
            const p=group[0]; // representative — identical across the whole group by definition
            const count=group.length;
            const potential=p.marketValue-p.allocatedCost;
            const onCardClick=count>1?()=>setViewingGroup(group):()=>setViewing(p);
            const ariaLabel=`${p.name}, ${p.category}, ${STATUS_LABEL[p.status]||p.status}, ${fmt(p.allocatedCost)}${count>1?` each, ${count} units`:""}`;
            return (
              <button key={groupKey(p)} onClick={onCardClick} aria-label={ariaLabel} className="bl-focusable bl-card-btn" style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:13,
                padding:10,cursor:"pointer",animation:`blFadeUp 0.18s ease ${Math.min(i*0.02,0.3)}s both`,transition:"border-color 0.15s,transform 0.1s",
                position:"relative",textAlign:"left",fontFamily:FONT_BODY,display:"block"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=t.borderStrong;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;}}
                onMouseDown={e=>e.currentTarget.style.transform="scale(0.98)"}
                onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}>
                <div style={{width:"100%",aspectRatio:"1",borderRadius:9,overflow:"hidden",background:t.surfaceSunken,marginBottom:8,
                  display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${t.border}`,position:"relative"}}>
                  {p.photoUrl?(
                    <img src={p.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  ):(
                    <Wrench size={24} strokeWidth={1.5} color={t.textFaint}/>
                  )}
                  {count>1&&(
                    <div style={{position:"absolute",top:6,right:6,background:t.accentStrong,color:t.accentContrast,fontSize:11,fontWeight:800,
                      padding:"3px 8px",borderRadius:99,boxShadow:t.shadowSm}}>×{count}</div>
                  )}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:4,marginBottom:4}}>
                  <StatusBadge s={p.status}/>
                  <span style={{color:t.textFaint,fontSize:9.5,whiteSpace:"nowrap"}}>{p.category}</span>
                </div>
                <div style={{color:t.text,fontWeight:600,fontSize:12.5,lineHeight:1.3,marginBottom:4,
                  display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{p.name}</div>
                <div style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text,fontSize:13}}>
                  {fmt(p.allocatedCost)}{count>1&&<span style={{color:t.textFaint,fontWeight:500,fontSize:11}}> each</span>}
                </div>
                {count>1?(
                  <div style={{fontSize:10,color:t.accent,marginTop:2,fontWeight:600}}>Total {fmt(p.allocatedCost*count)} · view all {count}</div>
                ):(
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:t.textFaint,marginTop:2}}>
                    <span>Market {fmt(p.marketValue)}</span>
                    <span style={{color:potential>=0?t.positive:t.negative,fontWeight:600}}>{potential>=0?"+":""}{fmt(potential)}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
function CategoryPartPicker({avail,categoriesPresent,activeCat,setActiveCat,search,setSearch,selectedIds,onToggle,selectedCountByCat}) {
  const t=useTheme();
  const partsInActiveCat=activeCat?avail.filter(p=>p.category===activeCat&&(!search||p.name.toLowerCase().includes(search.toLowerCase()))):[];
  if(avail.length===0)return <div style={{color:t.textFaint,fontSize:13}}>No available parts.</div>;
  return (
    <>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
        {categoriesPresent.map(cat=>{
          const count=selectedCountByCat(cat);
          const isActive=activeCat===cat;
          const tone=isActive?t.accent:count>0?t.positive:t.textMuted;
          return (
            <button key={cat} onClick={()=>{setActiveCat(isActive?null:cat);setSearch("");}} aria-pressed={isActive} className="bl-focusable"
              style={{display:"flex",alignItems:"center",gap:5,padding:"8px 13px",borderRadius:99,fontSize:12.5,fontWeight:600,cursor:"pointer",
                border:`1px solid ${isActive?t.accentSoftBorder:count>0?t.positiveSoftBorder:t.border}`,
                background:isActive?t.accentSoft:count>0?t.positiveSoft:t.surfaceSunken,
                color:tone,transition:"all 0.15s",fontFamily:FONT_BODY}}>
              {count>0&&<Check size={12} strokeWidth={3}/>}
              <span>{cat}</span>
              <span style={{opacity:0.7}}>({avail.filter(p=>p.category===cat).length}{count>0?`, ${count} picked`:""})</span>
            </button>
          );
        })}
      </div>

      {activeCat&&(
        <div style={{marginBottom:14,animation:"blFadeUp 0.18s ease"}}>
          <Inp value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${activeCat}…`} icon={Search} aria-label={`Search ${activeCat}`}/>
          {partsInActiveCat.length===0?(
            <div style={{color:t.textFaint,fontSize:13,padding:"14px 0"}}>No {activeCat} parts match.</div>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginTop:10}}>
              {partsInActiveCat.map(p=>{
                const checked=selectedIds.includes(p.id);
                return (
                  <button key={p.id} onClick={()=>onToggle(p.id)} aria-pressed={checked} className="bl-focusable" style={{cursor:"pointer",borderRadius:11,padding:9,
                    border:`1.5px solid ${checked?t.accent:t.border}`,background:checked?t.accentSoft:t.surfaceSunken,
                    transition:"all 0.12s",position:"relative",textAlign:"left",fontFamily:FONT_BODY}}>
                    {checked&&<div aria-hidden="true" style={{position:"absolute",top:6,right:6,width:18,height:18,borderRadius:"50%",
                      background:t.accentStrong,color:t.accentContrast,display:"flex",alignItems:"center",justifyContent:"center"}}><Check size={11} strokeWidth={3} color={t.accentContrast}/></div>}
                    <div style={{width:"100%",aspectRatio:"1",borderRadius:8,overflow:"hidden",background:t.surface,marginBottom:6,
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {p.photoUrl?<img src={p.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<Wrench size={18} strokeWidth={1.5} color={t.textFaint}/>}
                    </div>
                    <div style={{color:t.text,fontSize:12,fontWeight:600,lineHeight:1.3,marginBottom:3,
                      display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{p.name}</div>
                    <div style={{fontFamily:FONT_MONO,fontSize:11.5,color:t.textMuted}}>{fmt(p.allocatedCost)}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════
   EDIT BUILD PARTS MODAL
═══════════════════════════════════════════ */
function EditBuildPartsModal({build,state,dispatch,toast,onClose}) {
  const t=useTheme();
  const currentParts=state.parts.filter(p=>build.partIds.includes(p.id));
  const [toRemove,setToRemove]=useState([]); // partIds staged for removal (not yet dispatched)
  const [toAdd,setToAdd]=useState([]); // partIds staged for adding
  const [activeCat,setActiveCat]=useState(null);
  const [pickerSearch,setPickerSearch]=useState("");

  // Same Domain Firewall as build creation — only PC Parts, never General Assets.
  const avail=state.parts.filter(p=>p.status==="available"&&domainOf(p.category,state.customCategories)==="pc_part");
  const customPcPartCats=(state.customCategories||[]).filter(c=>c.domain==="pc_part").map(c=>c.name);
  const categoriesPresent=[...CATEGORIES,...customPcPartCats].filter(c=>avail.some(p=>p.category===c));
  const selectedCountByCat=cat=>avail.filter(p=>p.category===cat&&toAdd.includes(p.id)).length;
  const toggleAdd=id=>setToAdd(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  const toggleRemove=id=>setToRemove(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  const keptParts=currentParts.filter(p=>!toRemove.includes(p.id));
  const addedParts=avail.filter(p=>toAdd.includes(p.id));
  const previewCost=keptParts.reduce((s,p)=>s+p.allocatedCost,0)+addedParts.reduce((s,p)=>s+p.allocatedCost,0);
  const hasChanges=toRemove.length>0||toAdd.length>0;

  const save=()=>{
    if(keptParts.length+addedParts.length===0){
      toast("A build needs at least one part left in it","error");
      return;
    }
    dispatch({type:"EDIT_BUILD_PARTS",buildId:build.id,addPartIds:toAdd,removePartIds:toRemove});
    const bits=[];
    if(toAdd.length)bits.push(`${toAdd.length} added`);
    if(toRemove.length)bits.push(`${toRemove.length} removed`);
    toast(`"${build.name}" updated — ${bits.join(", ")}`);
    onClose();
  };

  return (
    <ModalShell onClose={onClose} label={`Edit ${build.name}`} sheet maxWidth={520}>
      <div style={{padding:"6px 20px 20px"}}>
        <div style={{color:t.text,fontWeight:700,fontSize:17,marginBottom:3,fontFamily:FONT_DISPLAY}}>Edit "{build.name}"</div>
        <div style={{color:t.textMuted,fontSize:12,marginBottom:18}}>Swap parts in or out — works even if this build is already listed for sale.</div>

        <SectionHeader title={`Currently in this build (${keptParts.length})`}/>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
          {currentParts.length===0&&<div style={{color:t.textFaint,fontSize:12}}>No parts left — add some below before saving.</div>}
          {currentParts.map(p=>{
            const marked=toRemove.includes(p.id);
            return (
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",borderRadius:8,
                background:marked?t.negativeSoft:t.surfaceSunken,border:`1px solid ${marked?t.negativeSoftBorder:t.border}`,
                opacity:marked?0.65:1,transition:"all 0.15s"}}>
                <PhotoThumb url={p.photoUrl} size={30} seed={p.id.length}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:t.text,fontSize:12.5,textDecoration:marked?"line-through":"none",
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                  <div style={{color:t.textFaint,fontSize:10.5}}>{p.category} · {fmt(p.allocatedCost)}</div>
                </div>
                <Btn small variant={marked?"ghost":"danger"} onClick={()=>toggleRemove(p.id)}>{marked?"Undo":"Remove"}</Btn>
              </div>
            );
          })}
        </div>

        <SectionHeader title={`Add more parts${toAdd.length>0?` (${toAdd.length} selected)`:""}`}/>
        <CategoryPartPicker avail={avail} categoriesPresent={categoriesPresent} activeCat={activeCat} setActiveCat={setActiveCat}
          search={pickerSearch} setSearch={setPickerSearch} selectedIds={toAdd} onToggle={toggleAdd} selectedCountByCat={selectedCountByCat}/>

        {hasChanges&&(
          <div style={{marginTop:4,paddingTop:14,borderTop:`1px solid ${t.border}`,marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}>
              <span style={{color:t.textMuted}}>Resulting part count</span>
              <span style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{keptParts.length+addedParts.length}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
              <span style={{color:t.textMuted}}>Resulting total cost</span>
              <span style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(previewCost)}</span>
            </div>
          </div>
        )}

        <div style={{display:"flex",gap:8}}>
          <Btn onClick={save} disabled={!hasChanges} style={{flex:1}}>Save changes</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   RECEIPT PRICE PROMPT
═══════════════════════════════════════════ */
function ReceiptPricePromptModal({buildName,onConfirm,onCancel}) {
  const t=useTheme();
  const [price,setPrice]=useState("");
  const submit=()=>{
    const n=parseFloat(price);
    if(!n||n<=0)return;
    onConfirm(n);
  };
  return (
    <ModalShell onClose={onCancel} label="Make a receipt" maxWidth={360}>
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:4,fontFamily:FONT_DISPLAY}}>Make a receipt</div>
      <div style={{fontSize:12,color:t.textMuted,marginBottom:16,lineHeight:1.5}}>
        "{buildName}" hasn't sold yet — enter the price you're quoting, and each part will be scaled proportionally to add up to it.
      </div>
      <Inp label="Input price (₱)" type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder="e.g. 32000" autoFocus/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={submit} disabled={!price||parseFloat(price)<=0} style={{flex:1}}>Generate</Btn>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   BUILD DETAIL SHEET
═══════════════════════════════════════════ */
function BuildDetailSheet({build,parts,onClose,openLightbox,onDissolve,onCopySpecs,onDelete,onEdit}) {
  const t=useTheme();
  const [showReceiptPrompt,setShowReceiptPrompt]=useState(false);
  const [buildReceipt,setBuildReceipt]=useState(null); // {rows,total} once a price has been entered
  const cost=parts.reduce((s,p)=>s+p.allocatedCost,0);
  const market=parts.reduce((s,p)=>s+p.marketValue,0);
  const potential=market-cost;

  const generateBuildReceipt=(inputPrice)=>{
    const totalMarket=parts.reduce((s,p)=>s+(p.marketValue||0),0);
    const rows=parts.map(p=>{
      const share=totalMarket>0?(p.marketValue||0)/totalMarket:(parts.length?1/parts.length:0);
      return {...p,scaledPrice:share*inputPrice};
    });
    setBuildReceipt({rows,total:inputPrice});
    setShowReceiptPrompt(false);
  };

  return (
    <ModalShell onClose={onClose} label={build.name} sheet maxWidth={520} padding={0}>
      <div style={{width:"100%",aspectRatio:"16/10",background:t.surfaceSunken,display:"flex",alignItems:"center",justifyContent:"center",borderBottom:`1px solid ${t.border}`}}>
        {build.photoUrl?(
          <button onClick={()=>openLightbox(build.photoUrl)} aria-label="View photo full-screen" className="bl-focusable"
            style={{width:"100%",height:"100%",border:"none",padding:0,background:"none",cursor:"pointer"}}>
            <img src={build.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          </button>
        ):(
          <Monitor size={40} strokeWidth={1.5} color={t.textFaint}/>
        )}
      </div>

      <div style={{padding:"18px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:14}}>
          <div style={{color:t.text,fontWeight:700,fontSize:19,fontFamily:FONT_DISPLAY}}>{build.name}</div>
          <span style={{fontSize:10.5,fontWeight:700,color:t.info,letterSpacing:"0.03em"}}>Active build</span>
        </div>

        <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:t.textMuted,marginBottom:10}}>Cost breakdown</div>
          {[["Total cost",fmt(cost),t.text],["Market value",fmt(market),t.text],
            ["Potential profit",`${potential>=0?"+":""}${fmt(potential)}`,potential>=0?t.positive:t.negative]
          ].map(([l,v,c],i)=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:i<2?7:0,paddingTop:i===2?8:0,borderTop:i===2?`1px solid ${t.border}`:"none"}}>
              <span style={{color:t.textMuted}}>{l}</span>
              <span style={{fontFamily:FONT_MONO,fontWeight:i===2?700:600,color:c}}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:t.textMuted,marginBottom:10}}>Components ({parts.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {parts.map(p=>(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:9}}>
                <PhotoThumb url={p.photoUrl} size={32} seed={p.id.length} onClick={p.photoUrl?()=>openLightbox(p.photoUrl):undefined} label={`View photo of ${p.name}`}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:t.text,fontSize:13}}>{p.name}</div>
                  <div style={{color:t.textFaint,fontSize:10}}>{p.category}</div>
                </div>
                <span style={{fontFamily:FONT_MONO,fontSize:12,color:t.textMuted}}>{fmt(p.allocatedCost)}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
          <DetailRow label="Created" value={build.date}/>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <Btn variant="primary" icon={Pencil} onClick={onEdit} style={{width:"100%"}}>Edit parts — add or remove</Btn>
          <Btn variant="ghost" icon={Receipt} onClick={()=>setShowReceiptPrompt(true)} style={{width:"100%"}}>Make a receipt</Btn>
          <Btn variant="ghost" icon={Undo2} onClick={onDissolve} style={{width:"100%"}}>Dissolve build — return parts to inventory</Btn>
          <Btn variant="ghost" icon={ClipboardList} onClick={onCopySpecs} style={{width:"100%"}}>Copy specs for listing</Btn>
          <div style={{paddingTop:6,borderTop:`1px solid ${t.border}`,marginTop:6}}>
            <Btn variant="danger" icon={Trash2} onClick={onDelete} style={{width:"100%"}}>Delete build</Btn>
          </div>
        </div>
      </div>
      {showReceiptPrompt&&(
        <ReceiptPricePromptModal buildName={build.name} onCancel={()=>setShowReceiptPrompt(false)} onConfirm={generateBuildReceipt}/>
      )}
      {buildReceipt&&(
        <ReceiptModal title={build.name} date={today()} total={buildReceipt.total}
          receiptRows={buildReceipt.rows} onClose={()=>setBuildReceipt(null)}/>
      )}
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   BUILDS
═══════════════════════════════════════════ */
function Builds({state,dispatch,toast,openLightbox}) {
  const t=useTheme();
  const [creating,setCreating]=useState(false);
  const [buildName,setBuildName]=useState("");
  const [sel,setSel]=useState([]);
  const [activeCat,setActiveCat]=useState(null);
  const [pickerSearch,setPickerSearch]=useState("");
  const [buildPhoto,setBuildPhoto]=useState({photoUrl:"",photoRecordId:""});
  const [deletingBuild,setDeletingBuild]=useState(null);
  const [viewingBuild,setViewingBuild]=useState(null);
  const [editingBuild,setEditingBuild]=useState(null);
  const [receiptPromptBuild,setReceiptPromptBuild]=useState(null);
  const [buildReceipt,setBuildReceipt]=useState(null);
  // Domain Firewall: Builds must never see General Assets (phones, vehicles, etc.), only PC Parts.
  const avail=state.parts.filter(p=>p.status==="available"&&domainOf(p.category,state.customCategories)==="pc_part");
  const buildCost=avail.filter(p=>sel.includes(p.id)).reduce((s,p)=>s+p.allocatedCost,0);
  const buildMarket=avail.filter(p=>sel.includes(p.id)).reduce((s,p)=>s+p.marketValue,0);
  const toggle=id=>setSel(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  const customPcPartCats=(state.customCategories||[]).filter(c=>c.domain==="pc_part").map(c=>c.name);
  const categoriesPresent=[...CATEGORIES,...customPcPartCats].filter(c=>avail.some(p=>p.category===c));
  const selectedCountByCat=cat=>avail.filter(p=>p.category===cat&&sel.includes(p.id)).length;

  const submit=()=>{
    if(!buildName||sel.length===0){toast("Name the build and pick parts","error");return;}
    dispatch({type:"CREATE_BUILD",build:{id:uid(),name:buildName,partIds:sel,date:today(),photoUrl:buildPhoto.photoUrl,photoRecordId:buildPhoto.photoRecordId}});
    toast(`Build "${buildName}" created`);
    setBuildName("");setSel([]);setCreating(false);setBuildPhoto({photoUrl:"",photoRecordId:""});setActiveCat(null);
  };
  const dissolve=b=>{dispatch({type:"DISSOLVE_BUILD",buildId:b.id});toast(`"${b.name}" dissolved — parts returned`);};
  const deleteBuildKeepParts=()=>{
    dispatch({type:"DELETE_BUILD",buildId:deletingBuild.id,returnParts:true});
    toast(`"${deletingBuild.name}" deleted — parts returned to inventory`,"warn");
    setDeletingBuild(null);
  };
  const deleteBuildAndParts=()=>{
    dispatch({type:"DELETE_BUILD",buildId:deletingBuild.id,returnParts:false});
    toast(`"${deletingBuild.name}" and its parts permanently deleted`,"warn");
    setDeletingBuild(null);
  };

  const copySpecs=(build,bp)=>{
    const lines=[`${build.name}`,"",...bp.map(p=>`• ${p.category}: ${p.name}${p.notes?` (${p.notes})`:""}`),"",`Asking price: ${fmt(bp.reduce((s,p)=>s+p.marketValue,0))}`];
    const text=lines.join("\n");
    navigator.clipboard?.writeText(text).then(
      ()=>toast("Specs copied — paste into your listing"),
      ()=>toast("Couldn't copy — clipboard not available","error")
    );
  };

  const generateBuildReceipt=(build,bp,inputPrice)=>{
    const totalMarket=bp.reduce((s,p)=>s+(p.marketValue||0),0);
    const rows=bp.map(p=>{
      const share=totalMarket>0?(p.marketValue||0)/totalMarket:(bp.length?1/bp.length:0);
      return {...p,scaledPrice:share*inputPrice};
    });
    setBuildReceipt({rows,total:inputPrice,name:build.name});
    setReceiptPromptBuild(null);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {deletingBuild&&(
        <ConfirmModal title="Delete this build?" message={`What should happen to the parts in "${deletingBuild.name}"? Most of the time you want to keep them — only purge them if they're truly gone (e.g. parted out / destroyed).`}
          onCancel={()=>setDeletingBuild(null)}
          extraChoices={[
            {label:"Delete build, return parts to inventory (recommended)",onClick:deleteBuildKeepParts,variant:"success"},
            {label:"Delete build AND permanently destroy its parts",onClick:deleteBuildAndParts,variant:"danger"},
          ]}/>
      )}
      {editingBuild&&(
        <EditBuildPartsModal build={editingBuild} state={state} dispatch={dispatch} toast={toast} onClose={()=>setEditingBuild(null)}/>
      )}
      {viewingBuild&&(()=>{
        const bp=state.parts.filter(p=>viewingBuild.partIds.includes(p.id));
        return (
          <BuildDetailSheet build={viewingBuild} parts={bp} onClose={()=>setViewingBuild(null)} openLightbox={openLightbox}
            onDissolve={()=>{dissolve(viewingBuild);setViewingBuild(null);}}
            onCopySpecs={()=>copySpecs(viewingBuild,bp)}
            onDelete={()=>{setDeletingBuild(viewingBuild);setViewingBuild(null);}}
            onEdit={()=>{setEditingBuild(viewingBuild);setViewingBuild(null);}}/>
        );
      })()}
      {receiptPromptBuild&&(
        <ReceiptPricePromptModal buildName={receiptPromptBuild.name} onCancel={()=>setReceiptPromptBuild(null)}
          onConfirm={(price)=>generateBuildReceipt(receiptPromptBuild,state.parts.filter(p=>receiptPromptBuild.partIds.includes(p.id)),price)}/>
      )}
      {buildReceipt&&(
        <ReceiptModal title={buildReceipt.name} date={today()} total={buildReceipt.total}
          receiptRows={buildReceipt.rows} onClose={()=>setBuildReceipt(null)}/>
      )}

      <PageHeader title="Builds" sub="Group parts into a sellable PC." action={!creating&&<Btn icon={Plus} onClick={()=>setCreating(true)}>New build</Btn>}/>

      {creating&&(
        <Card>
          <div style={{fontWeight:700,fontSize:13.5,color:t.text,marginBottom:14,fontFamily:FONT_DISPLAY}}>New build</div>
          <div style={{marginBottom:16}}>
            <PhotoUpload label="Build photo (optional) — the finished PC" photoUrl={buildPhoto.photoUrl} photoRecordId={buildPhoto.photoRecordId} onChange={setBuildPhoto}/>
          </div>
          <Inp label="Build name" value={buildName} onChange={e=>setBuildName(e.target.value)} placeholder="Gaming Rig #1" autoFocus/>

          <div style={{fontSize:12,color:t.textMuted,fontWeight:600,margin:"16px 0 9px"}}>Pick parts by category:</div>
          <CategoryPartPicker avail={avail} categoriesPresent={categoriesPresent} activeCat={activeCat} setActiveCat={setActiveCat}
            search={pickerSearch} setSearch={setPickerSearch} selectedIds={sel} onToggle={toggle} selectedCountByCat={selectedCountByCat}/>

          {sel.length>0&&(
            <div style={{marginTop:4,paddingTop:14,borderTop:`1px solid ${t.border}`}}>
              <div style={{fontSize:12,color:t.textMuted,fontWeight:600,marginBottom:9}}>Selected ({sel.length}):</div>
              <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12,maxHeight:160,overflowY:"auto"}}>
                {avail.filter(p=>sel.includes(p.id)).map(p=>(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                    <PhotoThumb url={p.photoUrl} size={26} seed={p.id.length}/>
                    <span style={{color:t.text,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                    <span style={{fontFamily:FONT_MONO,color:t.textFaint}}>{fmt(p.allocatedCost)}</span>
                    <IconBtn icon={X} label={`Remove ${p.name} from selection`} size={26} iconSize={13} onClick={()=>toggle(p.id)}/>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}>
                <span style={{color:t.textMuted}}>Build cost so far</span><span style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(buildCost)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                <span style={{color:t.textMuted}}>Market value</span><span style={{fontFamily:FONT_MONO,color:t.textMuted}}>{fmt(buildMarket)}</span>
              </div>
            </div>
          )}
          <div style={{display:"flex",gap:8,marginTop:16}}>
            <Btn onClick={submit} disabled={!buildName||sel.length===0}>Save build</Btn>
            <Btn variant="ghost" onClick={()=>{setCreating(false);setSel([]);setBuildName("");setActiveCat(null);}}>Cancel</Btn>
          </div>
        </Card>
      )}

      {state.builds.filter(b=>!b.dissolved&&!b.sold).length===0&&!creating?(
        <Card style={{textAlign:"center",padding:36}}>
          <Monitor size={28} strokeWidth={1.5} color={t.textFaint} style={{marginBottom:10}}/>
          <div style={{color:t.textFaint}}>No active builds.</div>
        </Card>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {state.builds.filter(b=>!b.dissolved&&!b.sold).map(build=>{
            const bp=state.parts.filter(p=>build.partIds.includes(p.id));
            const cost=bp.reduce((s,p)=>s+p.allocatedCost,0);
            const market=bp.reduce((s,p)=>s+p.marketValue,0);
            return (
              <Card key={build.id} style={{padding:0,overflow:"hidden"}}>
                {/* Photo + header open the detail sheet; this is a real <button> so it's keyboard-
                    reachable, which means the quick actions below must be siblings, not nested
                    inside it — a button can't legally contain another button. */}
                <button onClick={()=>setViewingBuild(build)} aria-label={`${build.name}, ${bp.length} parts, ${fmt(cost)}`} className="bl-focusable"
                  style={{display:"block",width:"100%",textAlign:"left",background:"none",border:"none",padding:0,margin:0,cursor:"pointer",font:"inherit"}}>
                  <div style={{width:"100%",aspectRatio:"16/9",background:t.surfaceSunken,display:"flex",alignItems:"center",justifyContent:"center",borderBottom:`1px solid ${t.border}`}}>
                    {build.photoUrl?(
                      <img src={build.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    ):(
                      <Monitor size={34} strokeWidth={1.5} color={t.textFaint}/>
                    )}
                  </div>
                  <div style={{padding:"16px 16px 0"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                      <div><div style={{color:t.text,fontWeight:700,fontSize:15,fontFamily:FONT_DISPLAY}}>{build.name}</div>
                        <div style={{color:t.textMuted,fontSize:11.5,marginTop:2}}>{build.date} · {bp.length} parts</div></div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(cost)}</div>
                        <div style={{fontSize:10,color:t.textFaint}}>market {fmt(market)}</div>
                      </div>
                    </div>
                  </div>
                </button>

                <div style={{padding:"12px 16px 16px"}}>
                  <div style={{display:"flex",gap:8,marginBottom:12}}>
                    <Btn small variant="ghost" icon={Pencil} onClick={()=>setEditingBuild(build)} style={{flex:1}}>Edit parts</Btn>
                    <Btn small variant="ghost" icon={Receipt} onClick={()=>setReceiptPromptBuild(build)} style={{flex:1}}>Make a receipt</Btn>
                  </div>

                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {bp.map(p=>(
                      <span key={p.id} style={{display:"inline-flex",alignItems:"center",gap:5,background:t.surfaceHover,border:`1px solid ${t.border}`,
                        borderRadius:99,fontSize:11,padding:"4px 10px",color:t.textMuted}}>
                        <span style={{color:t.accent,fontWeight:600}}>{p.category}</span>
                        <span style={{color:t.text}}>{p.name}</span>
                        <span style={{color:t.textFaint}}>{fmt(p.allocatedCost)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
function Sell({state,dispatch,toast,openLightbox}) {
  const t=useTheme();
  const [mode,setMode]=useState("part");
  const [selId,setSelId]=useState("");
  const [salePrice,setSalePrice]=useState("");
  const [buyer,setBuyer]=useState("");
  const [convoLink,setConvoLink]=useState("");
  const [proofPhoto,setProofPhoto]=useState({photoUrl:"",photoRecordId:""});
  const [loading,setLoading]=useState(false);
  const [pickerOpen,setPickerOpen]=useState(false);
  const targetMargin=state.settings?.targetMargin||30;

  const avail=state.parts.filter(p=>p.status==="available");
  const builds=state.builds.filter(b=>!b.dissolved&&!b.sold);
  const tp=avail.find(p=>p.id===selId);
  const tb=builds.find(b=>b.id===selId);
  const cost=mode==="part"?tp?.allocatedCost||0:tb?state.parts.filter(p=>tb.partIds.includes(p.id)).reduce((s,p)=>s+p.allocatedCost,0):0;
  const marketVal=mode==="part"?tp?.marketValue||0:tb?state.parts.filter(p=>tb.partIds.includes(p.id)).reduce((s,p)=>s+p.marketValue,0):0;
  const suggestedCostPlus=cost>0?Math.round(cost*(1+targetMargin/100)):0;
  const sp=parseFloat(salePrice)||0;
  const profit=sp-cost;
  const margin=cost>0?profit/cost:0;
  const selectedPhoto=mode==="part"?tp?.photoUrl:tb?.photoUrl;
  const selectedLabel=mode==="part"?tp?.name:tb?.name;

  const submit=()=>{
    if(!selId||!salePrice){toast("Select item and enter price","error");return;}
    setLoading(true);
    const name=mode==="part"?tp?.name:tb?.name;
    const buildPartsSnapshot=mode==="build"&&tb
      ?state.parts.filter(p=>tb.partIds.includes(p.id)).map(p=>({id:p.id,name:p.name,category:p.category,allocatedCost:p.allocatedCost,marketValue:p.marketValue,photoUrl:p.photoUrl}))
      :undefined;
    setTimeout(()=>{
      dispatch({type:"SELL",mode,id:selId,sale:{id:uid(),partId:mode==="part"?selId:null,buildId:mode==="build"?selId:null,name,cost,salePrice:sp,profit,buyerName:buyer,date:today(),
        buildPartsSnapshot,
        convoLink:convoLink.trim(),proofPhotoUrl:proofPhoto.photoUrl,proofPhotoRecordId:proofPhoto.photoRecordId}});
      toast(`${name} sold for ${fmt(sp)} — profit ${fmt(profit)}`,profit>=0?"success":"warn");
      setSelId("");setSalePrice("");setBuyer("");setConvoLink("");setProofPhoto({photoUrl:"",photoRecordId:""});setLoading(false);
    },400);
  };

  // Fewer clicks: the moment an item is picked, pre-fill the price with the cost-plus-margin
  // suggestion (the one most sales actually use) and focus it, already selected, so typing a
  // different number just overwrites — accepting the default is now zero extra clicks.
  const pickItem=(id)=>{
    setSelId(id);
    setPickerOpen(false);
    const part=avail.find(p=>p.id===id);
    const build=builds.find(b=>b.id===id);
    const itemCost=mode==="part"?part?.allocatedCost||0:build?state.parts.filter(p=>build.partIds.includes(p.id)).reduce((s,p)=>s+p.allocatedCost,0):0;
    if(itemCost>0)setSalePrice(String(Math.round(itemCost*(1+targetMargin/100))));
    requestAnimationFrame(()=>{
      const el=document.querySelector('[data-sell-price-input="1"]');
      el?.focus();el?.select?.();
    });
  };

  const list=mode==="part"?avail:builds;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <PageHeader title="Sell" sub="Record a sale and lock in your profit."/>
      <Segmented ariaLabel="What are you selling" value={mode} onChange={m=>{setMode(m);setSelId("");setPickerOpen(false);}}
        options={[["part","Sell part",Cpu],["build","Sell build",Monitor]]}/>
      <Card>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Photo-enabled picker — a native <select> can't render images, so this is a custom
              disclosure. Options are real, independently focusable <button>s (fully Tab/Enter
              reachable); Escape on the panel closes it and returns focus to the trigger. */}
          <div style={{position:"relative"}} onKeyDown={e=>{if(e.key==="Escape"){setPickerOpen(false);}}}>
            <div style={{fontSize:12.5,color:t.textMuted,fontWeight:500,marginBottom:6}}>{mode==="part"?"Select part":"Select build"}</div>
            <button type="button" onClick={()=>setPickerOpen(o=>!o)} aria-haspopup="listbox" aria-expanded={pickerOpen} className="bl-focusable"
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,minHeight:44,
              background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 12px",cursor:"pointer",textAlign:"left"}}>
              {selId?(
                <>
                  <PhotoThumb url={selectedPhoto} size={34} seed={selId.length}/>
                  <span style={{color:t.text,fontSize:13,flex:1}}>{selectedLabel}</span>
                  <span style={{fontFamily:FONT_MONO,fontSize:12,color:t.textMuted}}>{mode==="part"?fmt(tp?.allocatedCost||0):""}</span>
                </>
              ):<span style={{color:t.textFaint,fontSize:13,flex:1}}>— choose —</span>}
              <ChevronDown size={15} color={t.textMuted} style={{transform:pickerOpen?"rotate(180deg)":"none",transition:"transform 0.15s",flexShrink:0}}/>
            </button>
            {pickerOpen&&(
              <>
                <div onClick={()=>setPickerOpen(false)} aria-hidden="true" style={{position:"fixed",inset:0,zIndex:40}}/>
                <div role="listbox" aria-label={mode==="part"?"Available parts":"Available builds"} style={{position:"absolute",top:"100%",left:0,right:0,marginTop:6,background:t.bgElevated,
                  border:`1px solid ${t.border}`,borderRadius:9,overflow:"hidden",maxHeight:280,overflowY:"auto",
                  animation:"blFadeUp 0.15s ease",boxShadow:t.shadow,zIndex:50}}>
                  {list.length===0?(
                    <div style={{padding:14,color:t.textFaint,fontSize:13}}>Nothing available to sell.</div>
                  ):list.map(item=>(
                    <button key={item.id} type="button" role="option" aria-selected={selId===item.id} onClick={()=>pickItem(item.id)}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:10,background:selId===item.id?t.accentSoft:"transparent",
                        border:"none",borderBottom:`1px solid ${t.border}`,padding:"9px 12px",cursor:"pointer",textAlign:"left",fontFamily:FONT_BODY,minHeight:44}}
                      onMouseEnter={e=>e.currentTarget.style.background=t.surfaceHover}
                      onMouseLeave={e=>e.currentTarget.style.background=selId===item.id?t.accentSoft:"transparent"}>
                      <PhotoThumb url={item.photoUrl} size={34} seed={item.id.length}/>
                      <span style={{color:t.text,fontSize:13,flex:1}}>{item.name}</span>
                      <span style={{fontFamily:FONT_MONO,fontSize:12,color:t.textMuted}}>{mode==="part"?fmt(item.allocatedCost):""}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Price suggestion — two options, since anchoring only to cost-plus-margin undersells
              when the item's real market value is much higher than what it cost to acquire. */}
          {selId&&(cost>0||marketVal>0)&&(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {cost>0&&(
                <div style={{background:t.accentSoft,border:`1px solid ${t.accentSoftBorder}`,borderRadius:9,padding:"9px 12px",fontSize:12,color:t.accent,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                  <span>Cost + {targetMargin}% margin</span>
                  <Btn small onClick={()=>setSalePrice(String(suggestedCostPlus))}>Use {fmt(suggestedCostPlus)}</Btn>
                </div>
              )}
              {marketVal>0&&(
                <div style={{background:t.infoSoft,border:`1px solid ${t.infoSoftBorder}`,borderRadius:9,padding:"9px 12px",fontSize:12,color:t.info,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                  <span>Use market price</span>
                  <Btn small variant="info" onClick={()=>setSalePrice(String(marketVal))}>Use {fmt(marketVal)}</Btn>
                </div>
              )}
            </div>
          )}
          <Inp label="Sale price (₱)" type="number" value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="5000" data-sell-price-input="1"/>
          <Inp label="Buyer name (optional)" value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="Juan dela Cruz"/>
          <Inp label="Conversation link (optional)" value={convoLink} onChange={e=>setConvoLink(e.target.value)} placeholder="https://m.me/... or FB Marketplace chat link" icon={LinkIcon}/>
          <PhotoUpload label="Proof of transaction (optional) — screenshot or photo" photoUrl={proofPhoto.photoUrl} photoRecordId={proofPhoto.photoRecordId} onChange={setProofPhoto}/>
          {selId&&sp>0&&(
            <div style={{background:t.surfaceSunken,borderRadius:9,padding:13,border:`1px solid ${t.border}`,animation:"blFadeUp 0.2s ease"}}>
              {[["Cost",fmt(cost),t.text],["Sale price",fmt(sp),t.text],
                ["Profit",`${profit>=0?"+":""}${fmt(profit)} (${pct(margin)})`,profit>=0?t.positive:t.negative]
              ].map(([l,v,c],i)=>(
                <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:i<2?6:0,paddingTop:i===2?8:0,borderTop:i===2?`1px solid ${t.border}`:"none"}}>
                  <span style={{color:t.textMuted}}>{l}</span>
                  <span style={{fontFamily:FONT_MONO,fontWeight:i===2?700:400,color:c}}>{v}</span>
                </div>
              ))}
            </div>
          )}
          <Btn variant="success" icon={Check} loading={loading} onClick={submit} disabled={!selId||!salePrice} style={{width:"100%"}}>Record sale</Btn>
        </div>
      </Card>
    </div>
  );
}
const STATUS_COLOR_KEY={completed:"positive",returned:"warning",deleted:"neutral"};
function History({state,dispatch,toast,openLightbox,jumpRequest}) {
  const t=useTheme();
  const [view,setView]=useState("transactions"); // "transactions" | "partTimeline" | "ledger"
  const [walletFilter,setWalletFilter]=useState("business");
  const [sel,setSel]=useState("");
  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");
  const [dateFrom,setDateFrom]=useState("");
  const [dateTo,setDateTo]=useState("");
  useEffect(()=>{
    if(jumpRequest){
      setView("transactions");
      setSearch(jumpRequest.query);
      setTypeFilter("all");
    }
  },[jumpRequest]);
  const [plFilter,setPlFilter]=useState("all");
  const [viewingSale,setViewingSale]=useState(null);
  const [editingSale,setEditingSale]=useState(null);
  const [undoingSale,setUndoingSale]=useState(null);
  const [deletingSale,setDeletingSale]=useState(null);
  const part=state.parts.find(p=>p.id===sel);

  const allSales=state.sales;
  const activeSales=allSales.filter(s=>!s.deleted&&!s.returned&&!s.writeOff);

  const ledgerEntries=(state.transactions||[])
    .filter(t=>t.type==="TRANSFER"?(t.from===walletFilter||t.to===walletFilter):t.wallet===walletFilter)
    .map(t=>({...t,_positive: t.type==="TRANSFER"?t.to===walletFilter:(t.type==="INCOME"||t.type==="SALE")}));

  const filtered=allSales.filter(s=>{
    if(s.writeOff)return false;
    if(typeFilter==="returned"&&!s.returned)return false;
    if(typeFilter==="deleted"&&!s.deleted)return false;
    if(typeFilter==="part"&&(s.deleted||s.returned||s.buildId))return false;
    if(typeFilter==="build"&&(s.deleted||s.returned||!s.buildId))return false;
    if(typeFilter==="all"&&(s.deleted||s.returned))return false;
    if(search){
      const q=search.toLowerCase();
      if(!s.name.toLowerCase().includes(q)&&!(s.buyerName||"").toLowerCase().includes(q))return false;
    }
    if(dateFrom&&new Date(s.date)<new Date(dateFrom))return false;
    if(dateTo&&new Date(s.date)>new Date(dateTo))return false;
    if(plFilter==="profit"&&s.profit<0)return false;
    if(plFilter==="loss"&&s.profit>=0)return false;
    return true;
  });

  const totalRevenue=activeSales.reduce((s,x)=>s+x.salePrice,0);
  const totalProfitAll=activeSales.reduce((s,x)=>s+x.profit,0);
  const totalLosses=activeSales.filter(s=>s.profit<0).reduce((s,x)=>s+Math.abs(x.profit),0);
  const partsSoldCount=activeSales.filter(s=>!s.buildId).length;
  const buildsSoldCount=activeSales.filter(s=>s.buildId).length;
  const avgProfit=activeSales.length?totalProfitAll/activeSales.length:0;
  const catTotals={};
  activeSales.forEach(s=>{
    const p=state.parts.find(p=>p.id===s.partId);
    const cat=p?.category||(s.buildId?"Build":"Other");
    catTotals[cat]=(catTotals[cat]||0)+s.profit;
  });
  const bestCategory=Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];
  const bestItem=[...activeSales].sort((a,b)=>b.profit-a.profit)[0];

  const undoSale=(reason,buildDisposition)=>{
    dispatch({type:"UNDO_SALE",saleId:undoingSale.id,reason,buildDisposition});
    toast(buildDisposition==="reactivate"
      ? `"${undoingSale.name}" sale undone — build reactivated`
      : `"${undoingSale.name}" sale undone — returned to inventory`,"warn");
    setUndoingSale(null);setViewingSale(null);
  };

  const saveEdit=(changes)=>{
    dispatch({type:"EDIT_SALE",saleId:editingSale.id,changes});
    toast("Transaction updated");
    setEditingSale(null);
  };

  const deleteRecordOnly=()=>{
    dispatch({type:"DELETE_SALE",saleId:deletingSale.id,mode:"record-only"});
    toast("Transaction record deleted","warn");
    setDeletingSale(null);setViewingSale(null);
  };

  const deleteAndReturnDisassemble=()=>{
    dispatch({type:"DELETE_SALE",saleId:deletingSale.id,mode:"undo-and-return",buildDisposition:"disassemble"});
    toast("Transaction deleted — item returned to inventory","warn");
    setDeletingSale(null);setViewingSale(null);
  };

  const deleteAndReactivateBuild=()=>{
    dispatch({type:"DELETE_SALE",saleId:deletingSale.id,mode:"undo-and-return",buildDisposition:"reactivate"});
    toast("Transaction deleted — build reactivated and sellable again","warn");
    setDeletingSale(null);setViewingSale(null);
  };

  const exportCSV=()=>{
    const rows=[["Name","Category","Source","Cost","Market Value","Status","Sale Price","Profit","Buyer","Date"]];
    state.parts.forEach(p=>{
      const sale=state.sales.find(s=>s.partId===p.id&&!s.deleted&&!s.returned)||state.sales.find(s=>s.name===p.name&&!s.deleted&&!s.returned);
      rows.push([p.name,p.category,p.source,p.allocatedCost,p.marketValue,p.status,sale?sale.salePrice:"",sale?sale.profit:"",sale?sale.buyerName||"":"",sale?.date||""]);
    });
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`pc-trader-${today().replace(/\s/g,"-")}.csv`;a.click();
    URL.revokeObjectURL(url);
  };

  const statusOf=s=>s.deleted?"deleted":s.returned?"returned":"completed";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {viewingSale&&(
        <TransactionDetailSheet sale={viewingSale} state={state} openLightbox={openLightbox} onClose={()=>setViewingSale(null)}
          onEdit={()=>{setEditingSale(viewingSale);setViewingSale(null);}}
          onUndo={()=>{setUndoingSale(viewingSale);setViewingSale(null);}}
          onDelete={()=>{setDeletingSale(viewingSale);setViewingSale(null);}}/>
      )}
      {editingSale&&<EditSaleModal sale={editingSale} onClose={()=>setEditingSale(null)} onSave={saveEdit}/>}
      {undoingSale&&<ReturnReasonModal title="Undo this sale?" sale={undoingSale} onConfirm={undoSale} onCancel={()=>setUndoingSale(null)}/>}
      {deletingSale&&(
        <ConfirmModal title="Delete this transaction?" message={deletingSale.buildId
            ? `"${deletingSale.name}" was sold as a build. What should happen to it?`
            : `What should happen to "${deletingSale.name}"?`}
          onCancel={()=>setDeletingSale(null)}
          extraChoices={deletingSale.buildId?[
            {label:"Delete record only (item stays sold)",onClick:deleteRecordOnly,variant:"warn"},
            {label:"Delete & put build back in Builds",onClick:deleteAndReactivateBuild,variant:"success"},
            {label:"Delete & disassemble into inventory",onClick:deleteAndReturnDisassemble,variant:"success"},
          ]:[
            {label:"Delete record only (item stays sold)",onClick:deleteRecordOnly,variant:"warn"},
            {label:"Delete & return item to inventory",onClick:deleteAndReturnDisassemble,variant:"success"},
          ]}/>
      )}

      <PageHeader title="History" sub="Transactions, sales analytics, and part movement."
        action={<Btn variant="ghost" icon={FileDown} onClick={exportCSV} disabled={state.parts.length===0}>CSV</Btn>}/>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:11,padding:14}}>
          <div style={{fontSize:10.5,color:t.textMuted,fontWeight:600,marginBottom:5}}>Business wallet</div>
          <div style={{fontSize:18,fontWeight:700,color:t.positive,fontFamily:FONT_MONO}}>{fmt(state.businessCash||0)}</div>
          <div style={{fontSize:10.5,color:t.textFaint,marginTop:4}}>for parts & builds</div>
        </div>
        <div style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:11,padding:14}}>
          <div style={{fontSize:10.5,color:t.textMuted,fontWeight:600,marginBottom:5}}>Personal wallet</div>
          <div style={{fontSize:18,fontWeight:700,color:t.info,fontFamily:FONT_MONO}}>{fmt(state.personalCash||0)}</div>
          <div style={{fontSize:10.5,color:t.textFaint,marginTop:4}}>your separate personal funds</div>
        </div>
      </div>

      <Segmented ariaLabel="History view" value={view} onChange={setView} options={[
        ["transactions","Sales history",ClipboardList],["partTimeline","Part timeline",HistoryIcon],["ledger","Cash ledger",Banknote],
      ]}/>

      {view==="partTimeline"?(
        <>
          <Sel label="Select part" value={sel} onChange={e=>setSel(e.target.value)}>
            <option value="">— choose a part —</option>
            {state.parts.map(p=><option key={p.id} value={p.id}>{p.name} ({p.status})</option>)}
          </Sel>
          {part&&(
            <Card>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,gap:10}}>
                <div style={{display:"flex",gap:11,minWidth:0}}>
                  {part.photoUrl&&<PhotoThumb url={part.photoUrl} size={56} seed={part.id.length} onClick={()=>openLightbox(part.photoUrl)} label={`View photo of ${part.name}`}/>}
                  <div>
                    <div style={{color:t.text,fontWeight:700,fontSize:15,fontFamily:FONT_DISPLAY}}>{part.name}</div>
                    <div style={{color:t.textMuted,fontSize:11.5,marginTop:2}}>{part.category} · {part.source}</div>
                    {part.notes&&<div style={{color:t.textMuted,fontSize:11.5,marginTop:4,display:"flex",alignItems:"center",gap:5}}><StickyNote size={11}/>{part.notes}</div>}
                    {part.soldTo&&<div style={{color:t.textFaint,fontSize:11,marginTop:2}}>Sold to: {part.soldTo}</div>}
                  </div>
                </div>
                <StatusBadge s={part.status}/>
              </div>
              <div style={{position:"relative",paddingLeft:16}}>
                <div style={{position:"absolute",left:0,top:0,bottom:0,width:1,background:t.border}}/>
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  {part.history.map((h,i)=>(
                    <div key={i} style={{position:"relative",animation:`blFadeUp 0.2s ease ${i*0.04}s both`}}>
                      <div style={{position:"absolute",left:-20,top:4,width:7,height:7,borderRadius:"50%",background:t.accent}}/>
                      <div style={{fontSize:10.5,color:t.textFaint}}>{h.date}</div>
                      <div style={{fontSize:13,color:t.text,marginTop:2}}>{h.event}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}
          {state.parts.length===0&&(
            <Card style={{textAlign:"center",padding:36}}><div style={{color:t.textFaint}}>No parts yet.</div></Card>
          )}
        </>
      ):view==="ledger"?(
        <>
          <Segmented ariaLabel="Wallet" value={walletFilter} onChange={setWalletFilter} options={[["business","Business wallet",Wallet],["personal","Personal wallet",User]]}/>

          {ledgerEntries.length===0?(
            <Card style={{textAlign:"center",padding:36}}><div style={{color:t.textFaint}}>No {walletFilter} wallet activity yet.</div></Card>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {ledgerEntries.map((tx,i)=>(
                <div key={tx.id} style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:11,padding:"12px 14px",
                  display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,
                  animation:`blFadeUp 0.18s ease ${Math.min(i*0.02,0.3)}s both`}}>
                  <div style={{minWidth:0}}>
                    <div style={{color:t.text,fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.description}</div>
                    <div style={{color:t.textFaint,fontSize:10.5,marginTop:2}}>{tx.date}</div>
                  </div>
                  <div style={{fontFamily:FONT_MONO,fontWeight:700,fontSize:14,color:tx._positive?t.positive:t.negative,whiteSpace:"nowrap"}}>
                    {tx._positive?"+":"-"}{fmt(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ):(
        <>
          {activeSales.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
              <StatBox label="Total revenue" value={fmt(totalRevenue)} color={t.positive}/>
              <StatBox label="Total profit" value={fmt(totalProfitAll)} color={totalProfitAll>=0?t.positive:t.negative}/>
              <StatBox label="Total losses" value={fmt(-totalLosses)} color={t.negative}/>
              <StatBox label="Avg. profit / sale" value={fmt(avgProfit)}/>
              <StatBox label="Parts sold" value={String(partsSoldCount)}/>
              <StatBox label="Builds sold" value={String(buildsSoldCount)}/>
              {bestCategory&&<StatBox label="Best category" value={bestCategory[0]} sub={`+${fmt(bestCategory[1])} profit`} color={t.info}/>}
              {bestItem&&<StatBox label="Most profitable sale" value={bestItem.name} sub={`+${fmt(bestItem.profit)}`} color={t.info}/>}
            </div>
          )}

          <Inp value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by item or buyer name…" icon={Search} aria-label="Search transactions"/>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[["all","All"],["part","Parts only"],["build","Builds only"],["returned","Returned"],["deleted","Deleted"]].map(([v,l])=>(
              <Btn key={v} small variant={typeFilter===v?"primary":"ghost"} onClick={()=>setTypeFilter(v)}>{l}</Btn>
            ))}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[["all","All P/L"],["profit","Profit only"],["loss","Loss only"]].map(([v,l])=>(
              <Btn key={v} small variant={plFilter===v?"primary":"ghost"} onClick={()=>setPlFilter(v)}>{l}</Btn>
            ))}
          </div>
          <div className="responsive-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Inp label="From date" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
            <Inp label="To date" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
          </div>

          {filtered.length===0?(
            <Card style={{textAlign:"center",padding:36}}>
              <ClipboardList size={28} strokeWidth={1.5} color={t.textFaint} style={{marginBottom:10}}/>
              <div style={{color:t.textFaint}}>No transactions match.</div>
            </Card>
          ):(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:10}}>
              {[...filtered].reverse().map((s,i)=>{
                const linkedPart=state.parts.find(p=>p.id===s.partId);
                const linkedBuild=state.builds.find(b=>b.id===s.buildId);
                const img=s.proofPhotoUrl||linkedPart?.photoUrl||linkedBuild?.photoUrl;
                const status=statusOf(s);
                const statusColor=t[STATUS_COLOR_KEY[status]]||t.textMuted;
                const ariaLabel=`${s.name}, ${status}, sold ${fmt(s.salePrice)}, ${s.profit>=0?"profit":"loss"} ${fmt(Math.abs(s.profit))}`;
                return (
                  <button key={s.id} onClick={()=>setViewingSale(s)} aria-label={ariaLabel} className="bl-focusable" style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:13,
                    padding:10,cursor:"pointer",animation:`blFadeUp 0.18s ease ${Math.min(i*0.02,0.3)}s both`,transition:"border-color 0.15s",
                    opacity:status==="deleted"?0.55:1,textAlign:"left",fontFamily:FONT_BODY,display:"block"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=t.borderStrong}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
                    <div style={{width:"100%",aspectRatio:"1",borderRadius:9,overflow:"hidden",background:t.surfaceSunken,marginBottom:8,
                      display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${t.border}`}}>
                      {img?<img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:(s.buildId?<Monitor size={22} strokeWidth={1.5} color={t.textFaint}/>:<Wrench size={22} strokeWidth={1.5} color={t.textFaint}/>)}
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:4,marginBottom:4}}>
                      <span style={{fontSize:9.5,fontWeight:700,color:statusColor,letterSpacing:"0.03em"}}>{status}</span>
                      <span style={{color:t.textFaint,fontSize:9}}>{s.buildId?"BUILD":"PART"}</span>
                    </div>
                    <div style={{color:t.text,fontWeight:600,fontSize:12.5,lineHeight:1.3,marginBottom:4,
                      display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{s.name}</div>
                    <div style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text,fontSize:13}}>{fmt(s.salePrice)}</div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:t.textFaint,marginTop:2}}>
                      <span>{s.date}</span>
                      <span style={{color:s.profit>=0?t.positive:t.negative,fontWeight:600}}>{s.profit>=0?"+":""}{fmt(s.profit)}</span>
                    </div>
                    {s.buyerName&&<div style={{color:t.textFaint,fontSize:10,marginTop:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:4}}><User size={10}/>{s.buyerName}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
function TransactionDetailSheet({sale,state,openLightbox,onClose,onEdit,onUndo,onDelete}) {
  const t=useTheme();
  const [showBreakdown,setShowBreakdown]=useState(false);
  const [showReceipt,setShowReceipt]=useState(false);
  const status=sale.deleted?"deleted":sale.returned?"returned":"completed";
  const statusColor=t[STATUS_COLOR_KEY[status]]||t.textMuted;
  const linkedPart=state.parts.find(p=>p.id===sale.partId);
  const linkedBuild=state.builds.find(b=>b.id===sale.buildId);
  const buildParts=sale.buildPartsSnapshot?.length
    ?sale.buildPartsSnapshot
    :(linkedBuild?state.parts.filter(p=>linkedBuild.partIds.includes(p.id)):[]);
  const totalPartsCost=buildParts.reduce((s,p)=>s+p.allocatedCost,0);
  const breakdownRows=buildParts.map(p=>{
    const costShare=totalPartsCost>0?p.allocatedCost/totalPartsCost:(buildParts.length?1/buildParts.length:0);
    return {
      ...p,
      costSharePct:costShare,
      allocatedSale:costShare*sale.salePrice,
      allocatedProfit:costShare*sale.profit,
    };
  });

  const totalMarketValue=buildParts.reduce((s,p)=>s+(p.marketValue||0),0);
  const receiptRows=buildParts.map(p=>{
    const marketShare=totalMarketValue>0?(p.marketValue||0)/totalMarketValue:(buildParts.length?1/buildParts.length:0);
    return {...p,scaledPrice:marketShare*sale.salePrice};
  });
  const img=sale.proofPhotoUrl||linkedPart?.photoUrl||linkedBuild?.photoUrl;
  return (
    <ModalShell onClose={onClose} label={sale.name} sheet maxWidth={520} padding={0}>
      <div style={{width:"100%",aspectRatio:"16/10",background:t.surfaceSunken,display:"flex",alignItems:"center",justifyContent:"center",borderBottom:`1px solid ${t.border}`}}>
        {img?(
          <button onClick={()=>openLightbox(img)} aria-label="View photo full-screen" className="bl-focusable"
            style={{width:"100%",height:"100%",border:"none",padding:0,background:"none",cursor:"pointer"}}>
            <img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          </button>
        ):(sale.buildId?<Monitor size={40} strokeWidth={1.5} color={t.textFaint}/>:<Wrench size={40} strokeWidth={1.5} color={t.textFaint}/>)}
      </div>
      <div style={{padding:"18px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:14}}>
          <div style={{color:t.text,fontWeight:700,fontSize:19,fontFamily:FONT_DISPLAY}}>{sale.name}</div>
          <span style={{fontSize:10.5,fontWeight:700,color:statusColor,letterSpacing:"0.04em"}}>{status.toUpperCase()}</span>
        </div>

        <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:t.textMuted,marginBottom:10}}>Transaction</div>
          {[["Cost price",fmt(sale.cost),t.text],["Sale price",fmt(sale.salePrice),t.text],
            ["Profit / loss",`${sale.profit>=0?"+":""}${fmt(sale.profit)}`,sale.profit>=0?t.positive:t.negative]
          ].map(([l,v,c],i)=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:i<2?7:0,paddingTop:i===2?8:0,borderTop:i===2?`1px solid ${t.border}`:"none"}}>
              <span style={{color:t.textMuted}}>{l}</span>
              <span style={{fontFamily:FONT_MONO,fontWeight:i===2?700:600,color:c}}>{v}</span>
            </div>
          ))}
        </div>

        {(sale.buildId||sale.buildPartsSnapshot?.length>0)&&(
          <div style={{marginBottom:14}}>
            <Btn variant="ghost" icon={showBreakdown?ChevronUp:Wrench} onClick={()=>setShowBreakdown(v=>!v)} style={{width:"100%"}}>
              {showBreakdown?"Hide parts":`View parts${buildParts.length?` (${buildParts.length})`:""}`}
            </Btn>

            {showBreakdown&&(buildParts.length===0?(
              <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14,marginTop:8,color:t.textMuted,fontSize:12}}>
                This build's individual parts are no longer available to look up (the build record was deleted after this sale) — only the total cost, sale price, and profit above are still known.
              </div>
            ):(
              <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14,marginTop:8,animation:"blFadeUp 0.18s ease"}}>
                <div style={{fontSize:10.5,color:t.textFaint,marginBottom:12,lineHeight:1.45}}>
                  Sale price and profit are attributed to each part in proportion to its share of what the build cost to assemble.
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:13}}>
                  {breakdownRows.map(p=>(
                    <div key={p.id}>
                      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:6}}>
                        <PhotoThumb url={p.photoUrl} size={30} seed={p.id.length}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{color:t.text,fontSize:12.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                          <div style={{color:t.textFaint,fontSize:10}}>{p.category}</div>
                        </div>
                        <span style={{fontFamily:FONT_MONO,fontSize:12.5,color:t.textMuted,flexShrink:0}}>{fmt(p.allocatedCost)}</span>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,paddingLeft:39}}>
                        <div>
                          <div style={{fontSize:9,color:t.textFaint}}>% of cost</div>
                          <div style={{fontSize:12,fontFamily:FONT_MONO,color:t.accent,fontWeight:600}}>{pct(p.costSharePct)}</div>
                        </div>
                        <div>
                          <div style={{fontSize:9,color:t.textFaint}}>Alloc. sale</div>
                          <div style={{fontSize:12,fontFamily:FONT_MONO,color:t.textMuted,fontWeight:600}}>{fmt(p.allocatedSale)}</div>
                        </div>
                        <div>
                          <div style={{fontSize:9,color:t.textFaint}}>Alloc. profit</div>
                          <div style={{fontSize:12,fontFamily:FONT_MONO,color:p.allocatedProfit>=0?t.positive:t.negative,fontWeight:600}}>
                            {p.allocatedProfit>=0?"+":""}{fmt(p.allocatedProfit)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:12,paddingTop:10,borderTop:`1px solid ${t.border}`}}>
                  <div>
                    <div style={{fontSize:9,color:t.textMuted}}>Total cost</div>
                    <div style={{fontSize:12.5,fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(totalPartsCost)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:t.textMuted}}>Total sale</div>
                    <div style={{fontSize:12.5,fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(sale.salePrice)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:t.textMuted}}>Total profit</div>
                    <div style={{fontSize:12.5,fontFamily:FONT_MONO,fontWeight:700,color:sale.profit>=0?t.positive:t.negative}}>
                      {sale.profit>=0?"+":""}{fmt(sale.profit)}
                    </div>
                  </div>
                </div>
                <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${t.border}`}}>
                  <Btn variant="primary" icon={Receipt} onClick={()=>setShowReceipt(true)} style={{width:"100%"}}>Generate receipt</Btn>
                  <div style={{fontSize:9.5,color:t.textFaint,marginTop:6,textAlign:"center"}}>Customer-facing invoice — no cost or profit info included</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
          <DetailRow label="Buyer" value={sale.buyerName||"—"}/>
          <DetailRow label="Sale date" value={sale.date}/>
          {sale.convoLink&&(
            <div>
              <div style={{fontSize:11,color:t.textFaint,marginBottom:2}}>Conversation</div>
              <a href={sale.convoLink} target="_blank" rel="noopener noreferrer" style={{color:t.info,fontSize:13,display:"inline-flex",alignItems:"center",gap:5}}>
                <LinkIcon size={12}/>Open conversation link
              </a>
            </div>
          )}
          {sale.notes&&<DetailRow label="Notes" value={sale.notes}/>}
          {sale.edited&&<DetailRow label="Last edited" value={sale.editedAt} valueColor={t.textFaint}/>}
          {sale.returned&&<DetailRow label="Return reason" value={sale.returnReason||"—"} valueColor={t.warning}/>}
        </div>

        {!sale.deleted&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Btn variant="ghost" icon={Pencil} onClick={onEdit}>Edit transaction</Btn>
            {!sale.returned&&<Btn variant="warn" icon={Undo2} onClick={onUndo}>Undo sale</Btn>}
            <div style={{paddingTop:6,borderTop:`1px solid ${t.border}`,marginTop:6}}>
              <Btn variant="danger" icon={Trash2} onClick={onDelete} style={{width:"100%"}}>Delete transaction</Btn>
            </div>
          </div>
        )}
      </div>
      {showReceipt&&<ReceiptModal title={sale.name} subtitle={sale.buyerName?`For ${sale.buyerName}`:undefined} date={sale.date} total={sale.salePrice} receiptRows={receiptRows} onClose={()=>setShowReceipt(false)}/>}
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   RECEIPT MODAL — customer-facing invoice. Deliberately shows ONLY item names and
   scaled prices that sum to what the customer actually paid.
═══════════════════════════════════════════ */
function ReceiptModal({title,subtitle,date,total,label,receiptRows,onClose}) {
  const t=useTheme();
  const [copied,setCopied]=useState(false);

  const copyReceipt=()=>{
    const lines=[
      title,
      "",
      ...receiptRows.map(p=>`${p.name}: ${fmt(p.scaledPrice)}`),
      "",
      `Total: ${fmt(total)}`,
    ];
    const text=lines.join("\n");
    navigator.clipboard?.writeText(text).then(
      ()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);},
      ()=>{}
    );
  };

  return (
    <ModalShell onClose={onClose} label={label||"Sales receipt"} maxWidth={400} padding={0}>
      <div style={{padding:"20px 22px 16px",borderBottom:`1px solid ${t.border}`}}>
        <div style={{color:t.textFaint,fontSize:11,fontWeight:600,marginBottom:5}}>{label||"Sales receipt"}</div>
        <div style={{color:t.text,fontWeight:700,fontSize:17,fontFamily:FONT_DISPLAY}}>{title}</div>
        {subtitle&&<div style={{color:t.textMuted,fontSize:12,marginTop:3}}>{subtitle}</div>}
        {date&&<div style={{color:t.textFaint,fontSize:11,marginTop:2}}>{date}</div>}
      </div>

      <div style={{padding:"16px 22px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:11,marginBottom:14}}>
          {receiptRows.map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:10}}>
              {p.photoUrl?(
                <PhotoThumb url={p.photoUrl} size={34} seed={p.id.length}/>
              ):(
                <div style={{width:34,height:34,flexShrink:0,borderRadius:7,background:t.surfaceSunken,border:`1px solid ${t.border}`,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Wrench size={14} strokeWidth={1.5} color={t.textFaint}/>
                </div>
              )}
              <span style={{flex:1,color:t.text,fontSize:13.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
              <span style={{fontFamily:FONT_MONO,fontSize:14,color:t.text,fontWeight:600,flexShrink:0}}>{fmt(p.scaledPrice)}</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:14,borderTop:`1px solid ${t.border}`}}>
          <span style={{color:t.text,fontWeight:700,fontSize:15}}>Total</span>
          <span style={{fontFamily:FONT_MONO,fontWeight:800,fontSize:19,color:t.text}}>{fmt(total)}</span>
        </div>
      </div>

      <div style={{padding:"0 22px 22px",display:"flex",flexDirection:"column",gap:8}}>
        <Btn icon={copied?Check:ClipboardCopy} onClick={copyReceipt} style={{width:"100%"}}>{copied?"Copied":"Copy receipt text"}</Btn>
        <Btn variant="ghost" onClick={onClose} style={{width:"100%"}}>Close</Btn>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   EDIT SALE MODAL
═══════════════════════════════════════════ */
function EditSaleModal({sale,onClose,onSave}) {
  const t=useTheme();
  const [salePrice,setSalePrice]=useState(String(sale.salePrice));
  const [buyerName,setBuyerName]=useState(sale.buyerName||"");
  const [notes,setNotes]=useState(sale.notes||"");
  const [date,setDate]=useState(sale.date);
  return (
    <ModalShell onClose={onClose} label="Edit transaction" maxWidth={420}>
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:4,fontFamily:FONT_DISPLAY}}>Edit transaction</div>
      <div style={{fontSize:12,color:t.textFaint,marginBottom:16}}>{sale.name}</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <Inp label="Sale price (₱)" type="number" value={salePrice} onChange={e=>setSalePrice(e.target.value)}/>
        <Inp label="Buyer name" value={buyerName} onChange={e=>setBuyerName(e.target.value)}/>
        <Inp label="Sale date" value={date} onChange={e=>setDate(e.target.value)} placeholder="Jun 20, 2026"/>
        <Inp label="Notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add a note about this sale"/>
        <div style={{fontSize:11,color:t.textFaint}}>Edits are logged with a timestamp for transparency.</div>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn onClick={()=>onSave({salePrice:parseFloat(salePrice)||sale.salePrice,buyerName,notes,date})} style={{flex:1}}>Save changes</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   RETURN REASON MODAL — used for Undo Sale
═══════════════════════════════════════════ */
function ReturnReasonModal({title,sale,onConfirm,onCancel}) {
  const t=useTheme();
  const [reason,setReason]=useState("Buyer cancelled");
  const [other,setOther]=useState("");
  const [buildDisposition,setBuildDisposition]=useState("reactivate");
  const reasons=["Buyer cancelled","Product returned","Incorrect sale entry","Other"];
  const isBuildSale=!!sale.buildId;
  return (
    <ModalShell onClose={onCancel} label={title}>
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:6,fontFamily:FONT_DISPLAY}}>{title}</div>
      <div style={{fontSize:13,color:t.textMuted,marginBottom:16,lineHeight:1.5}}>
        {isBuildSale
          ? `"${sale.name}" was sold as a build. The sale and profit/loss will be reversed either way — choose what happens to the build below.`
          : `"${sale.name}" will be returned to inventory and the profit/loss reversed.`}
      </div>
      <div role="radiogroup" aria-label="Reason" style={{display:"flex",flexDirection:"column",gap:7,marginBottom:14}}>
        {reasons.map(r=>(
          <label key={r} style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",padding:"8px 10px",borderRadius:8,
            border:`1px solid ${reason===r?t.accentSoftBorder:t.border}`,background:reason===r?t.accentSoft:"transparent"}}>
            <input type="radio" name="return-reason" checked={reason===r} onChange={()=>setReason(r)} style={{accentColor:t.accent}}/>
            <span style={{color:t.text,fontSize:13}}>{r}</span>
          </label>
        ))}
      </div>
      {reason==="Other"&&<Inp label="Specify reason" value={other} onChange={e=>setOther(e.target.value)} placeholder="What happened?"/>}

      {isBuildSale&&(
        <div style={{marginTop:14}}>
          <div style={{fontSize:12,color:t.textMuted,fontWeight:600,marginBottom:8}}>What should happen to the build?</div>
          <div role="radiogroup" aria-label="Build disposition" style={{display:"flex",flexDirection:"column",gap:7}}>
            <label style={{display:"flex",alignItems:"flex-start",gap:9,cursor:"pointer",padding:"10px",borderRadius:8,
              border:`1px solid ${buildDisposition==="reactivate"?t.accentSoftBorder:t.border}`,background:buildDisposition==="reactivate"?t.accentSoft:"transparent"}}>
              <input type="radio" name="build-disposition" checked={buildDisposition==="reactivate"} onChange={()=>setBuildDisposition("reactivate")} style={{accentColor:t.accent,marginTop:2}}/>
              <span>
                <span style={{color:t.text,fontSize:13,display:"block"}}>Put it back in Builds</span>
                <span style={{color:t.textFaint,fontSize:11}}>The PC is still assembled — make it sellable again as one unit.</span>
              </span>
            </label>
            <label style={{display:"flex",alignItems:"flex-start",gap:9,cursor:"pointer",padding:"10px",borderRadius:8,
              border:`1px solid ${buildDisposition==="disassemble"?t.accentSoftBorder:t.border}`,background:buildDisposition==="disassemble"?t.accentSoft:"transparent"}}>
              <input type="radio" name="build-disposition" checked={buildDisposition==="disassemble"} onChange={()=>setBuildDisposition("disassemble")} style={{accentColor:t.accent,marginTop:2}}/>
              <span>
                <span style={{color:t.text,fontSize:13,display:"block"}}>Disassemble into inventory</span>
                <span style={{color:t.textFaint,fontSize:11}}>Break the build apart — each part becomes individually available.</span>
              </span>
            </label>
          </div>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16}}>
        <Btn variant="warn" icon={Undo2} onClick={()=>onConfirm(reason==="Other"?(other||"Other"):reason,isBuildSale?buildDisposition:undefined)} style={{width:"100%"}}>Confirm undo</Btn>
        <Btn variant="ghost" onClick={onCancel} style={{width:"100%"}}>Cancel</Btn>
      </div>
    </ModalShell>
  );
}
function Settings({state,dispatch,toast,theme,setTheme}) {
  const t=useTheme();
  const [margin,setMargin]=useState(String(state.settings?.targetMargin||30));
  const [confirmingClear,setConfirmingClear]=useState(false);

  const save=()=>{
    dispatch({type:"SET_SETTING",key:"targetMargin",value:parseFloat(margin)||30});
    toast("Settings saved");
  };

  const clearData=()=>{
    fetch("/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(initialState)})
      .then(r=>{if(!r.ok)throw new Error(`Server returned ${r.status}`);window.location.reload();})
      .catch(()=>toast("Failed to clear data — check server connection","error"));
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {confirmingClear&&(
        <ConfirmModal title="Delete all data?" message="This permanently erases every part, build, sale, and wallet balance. This cannot be undone."
          confirmLabel="Delete everything" onConfirm={clearData} onCancel={()=>setConfirmingClear(false)}/>
      )}
      <PageHeader title="Settings" sub="App preferences."/>
      <Card>
        <SectionHeader icon={Wallet} title="Wallet balances"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14}}>
            <div style={{fontSize:10.5,color:t.textMuted,fontWeight:600,marginBottom:5}}>Business wallet</div>
            <div style={{fontSize:18,fontWeight:700,color:t.positive,fontFamily:FONT_MONO}}>{fmt(state.businessCash||0)}</div>
            <div style={{fontSize:10.5,color:t.textFaint,marginTop:4}}>Used for buying & selling parts</div>
          </div>
          <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14}}>
            <div style={{fontSize:10.5,color:t.textMuted,fontWeight:600,marginBottom:5}}>Personal wallet</div>
            <div style={{fontSize:18,fontWeight:700,color:t.info,fontFamily:FONT_MONO}}>{fmt(state.personalCash||0)}</div>
            <div style={{fontSize:10.5,color:t.textFaint,marginTop:4}}>Your separate personal funds</div>
          </div>
        </div>
      </Card>
      <Card>
        <SectionHeader icon={Tag} title="Selling defaults"/>
        <div style={{maxWidth:260}}>
          <Inp label="Target profit margin (%)" type="number" value={margin} onChange={e=>setMargin(e.target.value)}/>
        </div>
        <div style={{fontSize:11.5,color:t.textFaint,marginTop:8,marginBottom:14}}>Used to auto-suggest sale prices in the Sell tab and Quick Sell modal.</div>
        <Btn onClick={save}>Save</Btn>
      </Card>

      <Card>
        <SectionHeader icon={Sun} title="Appearance"/>
        <Segmented ariaLabel="Theme" value={theme} onChange={setTheme} options={[["dark","Dark",Moon],["light","Light",Sun]]}/>
      </Card>

      <Card>
        <SectionHeader icon={AlertTriangle} title="Data"/>
        <div style={{fontSize:12,color:t.textMuted,marginBottom:14}}>All data is saved to your database and synced across devices.</div>
        <Btn variant="danger" icon={Trash2} onClick={()=>setConfirmingClear(true)}>Clear all data</Btn>
      </Card>
    </div>
  );
}
function QuickActionsFab({state,dispatch,toast}) {
  const t=useTheme();
  const [open,setOpen]=useState(false);
  const [modal,setModal]=useState(null); // null | "buy" | "sell" | "note"

  const actions=[
    {key:"buy",icon:ShoppingCart,label:"Quick buy"},
    {key:"sell",icon:Zap,label:"Quick sell"},
    {key:"note",icon:StickyNote,label:"Note"},
  ];

  useEffect(()=>{
    if(!open)return;
    const onKey=e=>{if(e.key==="Escape")setOpen(false);};
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[open]);

  return (
    <>
      {open&&<div onClick={()=>setOpen(false)} aria-hidden="true" style={{position:"fixed",inset:0,zIndex:899,background:t.overlay}}/>}

      <div style={{position:"fixed",right:18,bottom:"calc(20px + env(safe-area-inset-bottom))",zIndex:900,
        display:"flex",flexDirection:"column",alignItems:"flex-end",gap:12}}>
        {open&&actions.map((a,i)=>(
          <button key={a.key} onClick={()=>{setModal(a.key);setOpen(false);}} className="bl-focusable"
            style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",
              background:t.bgElevated,border:`1px solid ${t.border}`,borderRadius:99,padding:"11px 18px 11px 15px",
              boxShadow:t.shadow,animation:`blFadeUp 0.18s ease ${(actions.length-1-i)*0.04}s both`}}>
            <a.icon size={17} strokeWidth={2} color={t.accent}/>
            <span style={{color:t.text,fontSize:13,fontWeight:600,whiteSpace:"nowrap"}}>{a.label}</span>
          </button>
        ))}

        <button onClick={()=>setOpen(o=>!o)} aria-expanded={open} aria-label={open?"Close quick actions":"Open quick actions"} className="bl-focusable"
          style={{width:56,height:56,borderRadius:"50%",border:"none",cursor:"pointer",
          background:t.accentStrong,color:t.accentContrast,display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:`0 8px 22px ${t.accent}55`,transform:open?"rotate(45deg)":"rotate(0deg)",transition:"transform 0.2s"}}>
          <Plus size={26} strokeWidth={2.25}/>
        </button>
      </div>

      {modal==="buy"&&<QuickBuyModal state={state} dispatch={dispatch} toast={toast} onClose={()=>setModal(null)}/>}
      {modal==="sell"&&<QuickSellPickerModal state={state} dispatch={dispatch} toast={toast} onClose={()=>setModal(null)}/>}
      {modal==="note"&&<QuickNoteModal dispatch={dispatch} toast={toast} onClose={()=>setModal(null)}/>}
    </>
  );
}

function QuickBuyModal({state,dispatch,toast,onClose}) {
  const t=useTheme();
  const [name,setName]=useState("");
  const [cat,setCat]=useState("Other");
  const [cost,setCost]=useState("");
  const [qty,setQty]=useState("1");

  const submit=()=>{
    if(!name||!cost){toast("Enter a name and cost","error");return;}
    const c=parseFloat(cost);
    const n=Math.max(1,parseInt(qty,10)||1);
    const newParts=Array.from({length:n},()=>({id:uid(),name,category:cat,marketValue:c,allocatedCost:c,
      source:"Quick Buy",bundleId:null,status:"available",notes:"",soldTo:"",photoUrl:"",photoRecordId:"",
      history:[{date:today(),event:`Quick Buy — bought for ${fmt(c)}`}]}));
    dispatch({type:"ADD_PARTS",parts:newParts});
    toast(n>1?`${n}× ${name} added — add photos/details later via Edit`:`${name} added — add photos/details later via Edit`);
    onClose();
  };

  return (
    <ModalShell onClose={onClose} label="Quick buy">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:4,fontFamily:FONT_DISPLAY,display:"flex",alignItems:"center",gap:8}}><ShoppingCart size={17} color={t.accent}/>Quick buy</div>
      <div style={{fontSize:12,color:t.textFaint,marginBottom:16}}>Lock it in fast — fill in the rest later.</div>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        <Inp label="Name" value={name} onChange={e=>setName(e.target.value)} placeholder="RX 580"/>
        <CategoryPicker label="Category" value={cat} onChange={setCat} customCategories={state.customCategories} dispatch={dispatch}/>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
          <Inp label="Cost (₱, per unit)" type="number" value={cost} onChange={e=>setCost(e.target.value)} placeholder="3000"/>
          <Inp label="Qty" type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)} placeholder="1"/>
        </div>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn onClick={submit} style={{flex:1}}>{parseInt(qty,10)>1?`Add ${Math.max(1,parseInt(qty,10)||1)} to inventory`:"Add to inventory"}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

function QuickSellPickerModal({state,dispatch,toast,onClose}) {
  const t=useTheme();
  const [search,setSearch]=useState("");
  const [selId,setSelId]=useState("");
  const [salePrice,setSalePrice]=useState("");
  const [buyer,setBuyer]=useState("");

  const avail=state.parts.filter(p=>p.status==="available");
  const builds=state.builds.filter(b=>!b.dissolved&&!b.sold);
  const items=[
    ...avail.map(p=>({id:p.id,name:p.name,cost:p.allocatedCost,mode:"part"})),
    ...builds.map(b=>({id:b.id,name:b.name,cost:state.parts.filter(p=>b.partIds.includes(p.id)).reduce((s,p)=>s+p.allocatedCost,0),mode:"build"})),
  ].filter(it=>!search||it.name.toLowerCase().includes(search.toLowerCase()));

  const selected=items.find(it=>it.id===selId);
  const sp=parseFloat(salePrice)||0;
  const profit=selected?sp-selected.cost:0;

  const submit=()=>{
    if(!selected||!salePrice){toast("Pick an item and enter a price","error");return;}
    const buildPartsSnapshot=selected.mode==="build"
      ?state.parts.filter(p=>builds.find(b=>b.id===selected.id)?.partIds.includes(p.id)).map(p=>({id:p.id,name:p.name,category:p.category,allocatedCost:p.allocatedCost,marketValue:p.marketValue,photoUrl:p.photoUrl}))
      :undefined;
    dispatch({type:"SELL",mode:selected.mode,id:selected.id,sale:{id:uid(),
      partId:selected.mode==="part"?selected.id:null,buildId:selected.mode==="build"?selected.id:null,
      name:selected.name,cost:selected.cost,salePrice:sp,profit,buyerName:buyer,date:today(),buildPartsSnapshot}});
    toast(`${selected.name} sold for ${fmt(sp)} — profit ${fmt(profit)}`,profit>=0?"success":"warn");
    onClose();
  };

  return (
    <ModalShell onClose={onClose} label="Quick sell">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:4,fontFamily:FONT_DISPLAY,display:"flex",alignItems:"center",gap:8}}><Zap size={17} color={t.accent}/>Quick sell</div>
      <div style={{fontSize:12,color:t.textFaint,marginBottom:16}}>Find it, price it, done.</div>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        {!selected?(
          <>
            <Inp value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search parts and builds…" icon={Search} aria-label="Search parts and builds"/>
            <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:240,overflowY:"auto"}}>
              {items.length===0?(
                <div style={{color:t.textFaint,fontSize:13,padding:"10px 0"}}>Nothing available to sell.</div>
              ):items.map(it=>(
                <button key={it.id} onClick={()=>setSelId(it.id)} className="bl-focusable" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,
                  width:"100%",background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",textAlign:"left",minHeight:44,fontFamily:FONT_BODY}}>
                  <span style={{color:t.text,fontSize:13,display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                    {it.mode==="build"?<Monitor size={14} color={t.textFaint} style={{flexShrink:0}}/>:<Wrench size={14} color={t.textFaint} style={{flexShrink:0}}/>}
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.name}</span>
                  </span>
                  <span style={{fontFamily:FONT_MONO,fontSize:12,color:t.textMuted,flexShrink:0}}>{fmt(it.cost)}</span>
                </button>
              ))}
            </div>
          </>
        ):(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:8,padding:"10px 12px"}}>
              <span style={{color:t.text,fontSize:13,display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                {selected.mode==="build"?<Monitor size={14} color={t.textFaint}/>:<Wrench size={14} color={t.textFaint}/>}
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected.name}</span>
              </span>
              <Btn small variant="ghost" onClick={()=>setSelId("")}>Change</Btn>
            </div>
            <Inp label="Sale price (₱)" type="number" value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="5000"/>
            <Inp label="Buyer name (optional)" value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="Juan dela Cruz"/>
            {sp>0&&(
              <div style={{fontSize:12,color:profit>=0?t.positive:t.negative,fontWeight:600}}>
                {profit>=0?"+":""}{fmt(profit)} profit
              </div>
            )}
          </>
        )}
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn variant="success" icon={Check} onClick={submit} disabled={!selected||!salePrice} style={{flex:1}}>Record sale</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

function QuickNoteModal({dispatch,toast,onClose}) {
  const t=useTheme();
  const [text,setText]=useState("");
  const [f,setF]=useState(false);
  const submit=()=>{
    if(!text.trim()){toast("Write something first","error");return;}
    dispatch({type:"ADD_QUICK_NOTE",text});
    toast("Note saved");
    onClose();
  };
  return (
    <ModalShell onClose={onClose} label="Quick note">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:4,fontFamily:FONT_DISPLAY,display:"flex",alignItems:"center",gap:8}}><StickyNote size={17} color={t.accent}/>Quick note</div>
      <div style={{fontSize:12,color:t.textFaint,marginBottom:14}}>Jot it down — sort it out later. Shows on your Dashboard.</div>
      <textarea autoFocus value={text} onChange={e=>setText(e.target.value)} placeholder="Seller has 3 more GPUs, follow up Friday..."
        onFocus={()=>setF(true)} onBlur={()=>setF(false)} aria-label="Note text"
        style={{width:"100%",minHeight:100,background:t.surfaceSunken,border:`1px solid ${f?t.accent:t.border}`,borderRadius:9,padding:"10px 12px",
          color:t.text,fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:FONT_BODY,
          boxShadow:f?`0 0 0 3px ${t.focusRing}`:"none",transition:"all 0.15s"}}/>
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <Btn onClick={submit} style={{flex:1}}>Save note</Btn>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      </div>
    </ModalShell>
  );
}

function AddIncomeModal({onClose, dispatch, toast}) {
  const t=useTheme();
  const [wallet, setWallet] = usePersistentState("pctrader:lastIncomeWallet","business");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");

  const handleAdd = () => {
    const amt = parseFloat(amount);
    if(!amt || !desc) return toast("Fill all fields", "error");
    dispatch({type: "ADD_INCOME", wallet, amount: amt, description: desc});
    toast(`+${fmt(amt)} added to ${wallet} wallet`);
    onClose();
  };

  return (
    <ModalShell onClose={onClose} label="Add income">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:4,fontFamily:FONT_DISPLAY}}>Add income</div>
      <div style={{fontSize:12,color:t.textFaint,marginBottom:14}}>Money coming in that isn't from selling inventory — a repair job, a service fee, anything like that.</div>
      <Segmented ariaLabel="Wallet" value={wallet} onChange={setWallet} options={[["business","Business",Wallet],["personal","Personal",User]]}/>
      <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:12}}>
        <Inp label="Description" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Fixed a PC for a client" />
        <Inp label="Amount (₱)" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" />
      </div>
      <div style={{marginTop:16, display:"flex", gap:8}}>
        <Btn variant="success" icon={Plus} onClick={handleAdd} style={{flex:1}}>Log income</Btn>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      </div>
    </ModalShell>
  );
}

function AddExpenseModal({onClose, dispatch, toast}) {
  const t=useTheme();
  const [wallet, setWallet] = usePersistentState("pctrader:lastExpenseWallet","business");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");

  const handleAdd = () => {
    const amt = parseFloat(amount);
    if(!amt || !desc) return toast("Fill all fields", "error");
    const expenseType = wallet === "personal" ? "personal_draw" : "business";
    dispatch({type: "ADD_EXPENSE", wallet, expenseType, amount: amt, description: desc});
    toast(`Added ${wallet} expense for ${fmt(amt)}`);
    onClose();
  };

  return (
    <ModalShell onClose={onClose} label="Add expense">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:14,fontFamily:FONT_DISPLAY}}>Add expense</div>
      <Segmented ariaLabel="Wallet" value={wallet} onChange={setWallet} options={[["business","Business",Wallet],["personal","Personal",User]]}/>
      <div style={{display:"flex",flexDirection:"column",gap:12,marginTop:12}}>
        <Inp label="Description" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="e.g. Tools, Lunch, Gas" />
        <Inp label="Amount (₱)" type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" />
      </div>
      <div style={{marginTop:16, display:"flex", gap:8}}>
        <Btn variant="danger" icon={Minus} onClick={handleAdd} style={{flex:1}}>Log expense</Btn>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
      </div>
    </ModalShell>
  );
}
const ALL_TABS=["Dashboard","Buy","Inventory","Builds","Sell","History","Settings"];
const TAB_ICON={Dashboard:LayoutDashboard,Buy:ShoppingCart,Inventory:Boxes,Builds:Wrench,Sell:Banknote,History:HistoryIcon,Settings:SettingsIcon};

/* ═══════════════════════════════════════════
   GLOBAL SEARCH — the fix for "finding things is clunky": one search box, reachable from
   anywhere (header icon or Ctrl/Cmd+K), that looks across parts, builds, and sales at once
   and jumps straight to the right tab with the result already filtered in.
═══════════════════════════════════════════ */
function GlobalSearchModal({state,onClose,onJump}) {
  const t=useTheme();
  const [q,setQ]=useState("");
  const query=q.trim().toLowerCase();

  const partResults=query?state.parts.filter(p=>p.name.toLowerCase().includes(query)||p.category.toLowerCase().includes(query)).slice(0,6):[];
  const buildResults=query?state.builds.filter(b=>!b.dissolved&&b.name.toLowerCase().includes(query)).slice(0,5):[];
  const saleResults=query?state.sales.filter(s=>!s.deleted&&(s.name.toLowerCase().includes(query)||(s.buyerName||"").toLowerCase().includes(query))).slice(0,5):[];
  const noResults=query&&partResults.length===0&&buildResults.length===0&&saleResults.length===0;

  const goInventory=()=>onJump("Inventory",{query:q,nonce:uid()});
  const goHistory=()=>onJump("History",{query:q,nonce:uid()});
  const goBuilds=()=>onJump("Builds",null);

  return (
    <ModalShell onClose={onClose} label="Search" maxWidth={480} padding={0}>
      <div style={{padding:"16px 18px",borderBottom:`1px solid ${t.border}`}}>
        <div style={{position:"relative"}}>
          <Search size={16} color={t.textFaint} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}} aria-hidden="true"/>
          <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search parts, builds, sales…"
            aria-label="Search everything"
            style={{width:"100%",boxSizing:"border-box",background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,
              padding:"11px 12px 11px 36px",color:t.text,fontSize:16,outline:"none",fontFamily:FONT_BODY}}/>
        </div>
      </div>
      <div style={{maxHeight:400,overflowY:"auto",padding:query?"8px 8px 14px":"20px 18px"}}>
        {!query&&<div style={{color:t.textFaint,fontSize:12.5,textAlign:"center",padding:"10px 0"}}>Start typing to search across everything at once.</div>}

        {partResults.length>0&&(
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10.5,fontWeight:700,color:t.textFaint,padding:"8px 10px 4px",letterSpacing:"0.03em"}}>PARTS</div>
            {partResults.map(p=>(
              <button key={p.id} onClick={goInventory} className="bl-focusable" style={{width:"100%",display:"flex",alignItems:"center",gap:10,
                padding:"9px 10px",borderRadius:8,border:"none",background:"transparent",cursor:"pointer",textAlign:"left",fontFamily:FONT_BODY,minHeight:44}}
                onMouseEnter={e=>e.currentTarget.style.background=t.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <PhotoThumb url={p.photoUrl} size={30} seed={p.id.length}/>
                <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:t.text,fontSize:13}}>{p.name}</span>
                <StatusBadge s={p.status}/>
              </button>
            ))}
          </div>
        )}

        {buildResults.length>0&&(
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10.5,fontWeight:700,color:t.textFaint,padding:"8px 10px 4px",letterSpacing:"0.03em"}}>BUILDS</div>
            {buildResults.map(b=>(
              <button key={b.id} onClick={goBuilds} className="bl-focusable" style={{width:"100%",display:"flex",alignItems:"center",gap:10,
                padding:"9px 10px",borderRadius:8,border:"none",background:"transparent",cursor:"pointer",textAlign:"left",fontFamily:FONT_BODY,minHeight:44}}
                onMouseEnter={e=>e.currentTarget.style.background=t.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <PhotoThumb url={b.photoUrl} size={30} seed={b.id.length}/>
                <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:t.text,fontSize:13}}>{b.name}</span>
                <Monitor size={14} color={t.textFaint}/>
              </button>
            ))}
          </div>
        )}

        {saleResults.length>0&&(
          <div>
            <div style={{fontSize:10.5,fontWeight:700,color:t.textFaint,padding:"8px 10px 4px",letterSpacing:"0.03em"}}>SALES</div>
            {saleResults.map(s=>(
              <button key={s.id} onClick={goHistory} className="bl-focusable" style={{width:"100%",display:"flex",alignItems:"center",gap:10,
                padding:"9px 10px",borderRadius:8,border:"none",background:"transparent",cursor:"pointer",textAlign:"left",fontFamily:FONT_BODY,minHeight:44}}
                onMouseEnter={e=>e.currentTarget.style.background=t.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <Receipt size={16} color={t.textFaint} style={{flexShrink:0}}/>
                <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:t.text,fontSize:13}}>{s.name}{s.buyerName?` · ${s.buyerName}`:""}</span>
                <span style={{fontFamily:FONT_MONO,fontSize:12,color:s.profit>=0?t.positive:t.negative}}>{fmt(s.salePrice)}</span>
              </button>
            ))}
          </div>
        )}

        {noResults&&<div style={{color:t.textFaint,fontSize:13,textAlign:"center",padding:"24px 0"}}>Nothing matches "{q}".</div>}
      </div>
    </ModalShell>
  );
}

function BrandMark({t,compact}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
      <div style={{width:34,height:34,borderRadius:9,background:t.accentStrong,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <Monitor size={18} color={t.accentContrast} strokeWidth={2.25}/>
      </div>
      {!compact&&(
        <div style={{minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,color:t.text,letterSpacing:"-0.01em",whiteSpace:"nowrap",fontFamily:FONT_DISPLAY}}>PC Trader</div>
          <div style={{fontSize:9.5,color:t.textFaint,letterSpacing:"0.08em",whiteSpace:"nowrap",fontWeight:600}}>BUY · BUILD · SELL</div>
        </div>
      )}
    </div>
  );
}

function SyncStatus({saveStatus,t,compact}) {
  const cfg=saveStatus==="saving"?{icon:Loader2,color:t.warning,label:"Saving…",spin:true}
    :saveStatus==="error"?{icon:AlertTriangle,color:t.negative,label:"Save failed",spin:false}
    :{icon:Check,color:t.positive,label:"Synced",spin:false};
  return (
    <div style={{display:"flex",alignItems:"center",gap:5}} role="status" aria-live="polite">
      <cfg.icon size={12} color={cfg.color} className={cfg.spin?"bl-spin":undefined}/>
      {!compact&&<span style={{fontSize:10.5,fontWeight:600,color:cfg.color,whiteSpace:"nowrap"}}>{cfg.label}</span>}
    </div>
  );
}

function LoadingScreen({t}) {
  return (
    <div style={{minHeight:"100vh",background:t.bg,color:t.text,display:"flex",alignItems:"center",justifyContent:"center",
      flexDirection:"column",gap:12,fontFamily:FONT_BODY}}>
      <Loader2 size={22} className="bl-spin" color={t.accent}/>
      <div style={{fontSize:13,color:t.textMuted}}>Loading your data…</div>
    </div>
  );
}

function ErrorScreen({t}) {
  return (
    <div style={{minHeight:"100vh",background:t.bg,color:t.negative,display:"flex",alignItems:"center",justifyContent:"center",
      flexDirection:"column",gap:8,fontFamily:FONT_BODY,padding:24,textAlign:"center"}}>
      <AlertTriangle size={26}/>
      <div style={{fontSize:18,fontWeight:700,color:t.text,fontFamily:FONT_DISPLAY}}>Couldn't load your data</div>
      <div style={{fontSize:13,color:t.textMuted,maxWidth:360}}>Check that the server is running and PocketBase is reachable, then refresh.</div>
    </div>
  );
}

export default function App() {
  const [state,setState]=useState(null);
  const [loadStatus,setLoadStatus]=useState("loading"); // loading | ready | error
  const [saveStatus,setSaveStatus]=useState("idle"); // idle | saving | error
  const saveTimer=useRef(null);
  const hasLoaded=useRef(false);

  // Load once from the server (which is backed by PocketBase)
  useEffect(()=>{
    fetch("/data")
      .then(r=>{if(!r.ok)throw new Error(`Server returned ${r.status}`);return r.json();})
      .then(json=>{
        let loadedState = json&&Object.keys(json).length?{...initialState,...json}:initialState;
        if(loadedState.businessCash===undefined && loadedState.liquidCash!==undefined) {
          loadedState.businessCash = loadedState.liquidCash;
        }
        // Start the historical series immediately. Existing accounts will have a current-day
        // baseline created on first load; future changes update that day's snapshot automatically.
        loadedState = recordNetWorthSnapshot(loadedState);
        setState(loadedState);
        setLoadStatus("ready");
        hasLoaded.current=true;
      })
      .catch(err=>{
        console.error("Failed to load data:",err);
        setLoadStatus("error");
      });
  },[]);

  // Keep a daily snapshot even when the app stays open across midnight without a business action.
  useEffect(()=>{
    const timer=setInterval(()=>{
      setState(prev=>{
        if(!hasLoaded.current || !prev) return prev;
        const todayKey=localISODate();
        const existing=(prev.netWorthSnapshots||[]).find(s=>s.date===todayKey);
        return existing ? prev : recordNetWorthSnapshot(prev);
      });
    },60*60*1000);
    return()=>clearInterval(timer);
  },[]);

  const dispatch=useCallback(action=>setState(prev=>{
    const next=reducer(prev,action);
    if(next===prev || !SNAPSHOT_ACTIONS.has(action?.type)) return next;
    return recordNetWorthSnapshot(next);
  }),[]);

  // Debounced save to the server whenever state changes (skip the initial load)
  useEffect(()=>{
    if(!hasLoaded.current||state===null)return;
    setSaveStatus("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      fetch("/data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(state)})
        .then(r=>{if(!r.ok)throw new Error(`Server returned ${r.status}`);setSaveStatus("idle");})
        .catch(err=>{console.error("Failed to save data:",err);setSaveStatus("error");});
    },500);
    return()=>clearTimeout(saveTimer.current);
  },[state]);

  const [tab,setTab]=useState("Dashboard");
  const {toasts,toast}=useToast();
  const [theme,setTheme]=useState("dark");
  const [lightboxUrl,setLightboxUrl]=useState(null);
  const openLightbox=useCallback(url=>setLightboxUrl(url),[]);
  const [searchOpen,setSearchOpen]=useState(false);
  const [inventoryJump,setInventoryJump]=useState(null);
  const [historyJump,setHistoryJump]=useState(null);

  // Global search — Ctrl/Cmd+K from anywhere opens it, addressing "finding things is clunky"
  // without adding yet another button to hunt for.
  useEffect(()=>{
    const onKey=e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setSearchOpen(o=>!o);}
    };
    document.addEventListener("keydown",onKey);
    return()=>document.removeEventListener("keydown",onKey);
  },[]);
  const jumpTo=useCallback((targetTab,request)=>{
    setTab(targetTab);
    if(targetTab==="Inventory")setInventoryJump(request);
    if(targetTab==="History")setHistoryJump(request);
    setSearchOpen(false);
  },[]);

  // Helper for chatbox to pre-fill form fields on AI commands
  const setFormData=useCallback((formType,data)=>{
    if(formType==="buy"){
      toast(`${data.singleName} - Cost: ${data.singleCost}, Market: ${data.singleMarket}`, "info");
    }
  },[toast]);

  const isDesktop=useMediaQuery("(min-width: 1024px)");
  const t=theme==="dark"?THEME.dark:THEME.light;

  if(loadStatus==="loading")return <LoadingScreen t={t}/>;
  if(loadStatus==="error")return <ErrorScreen t={t}/>;

  const contentMaxWidth=isDesktop?1120:740;
  const totalProfit=state.sales.filter(s=>!s.deleted&&!s.returned).reduce((s,x)=>s+x.profit,0);

  // All seven tabs stay mounted (toggled with display:none) instead of being conditionally
  // rendered, so an in-progress form (e.g. a half-typed Sell note) survives switching tabs and
  // coming back — unchanged from the original behavior, just reformatted.
  const panels=(
    <>
      <div style={{display:tab==="Dashboard"?"block":"none"}}><Dashboard state={state} dispatch={dispatch} toast={toast} setTab={setTab} openLightbox={openLightbox}/></div>
      <div style={{display:tab==="Buy"?"block":"none"}}><Buy state={state} dispatch={dispatch} toast={toast}/></div>
      <div style={{display:tab==="Inventory"?"block":"none"}}><Inventory state={state} dispatch={dispatch} toast={toast} setTab={setTab} openLightbox={openLightbox} jumpRequest={inventoryJump}/></div>
      <div style={{display:tab==="Builds"?"block":"none"}}><Builds state={state} dispatch={dispatch} toast={toast} openLightbox={openLightbox}/></div>
      <div style={{display:tab==="Sell"?"block":"none"}}><Sell state={state} dispatch={dispatch} toast={toast} openLightbox={openLightbox}/></div>
      <div style={{display:tab==="History"?"block":"none"}}><History state={state} dispatch={dispatch} toast={toast} openLightbox={openLightbox} jumpRequest={historyJump}/></div>
      <div style={{display:tab==="Settings"?"block":"none"}}><Settings state={state} dispatch={dispatch} toast={toast} theme={theme} setTheme={setTheme}/></div>
    </>
  );

  return (
    <ThemeCtx.Provider value={t}>
      <div style={{minHeight:"100vh",background:t.bg,color:t.text,fontFamily:FONT_BODY,transition:"background 0.3s,color 0.3s"}}>
        <style>{`
          @import url('${GOOGLE_FONTS_HREF}');
          @keyframes blFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
          @keyframes blSlideIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
          @keyframes blSlideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
          @keyframes blSpin{to{transform:rotate(360deg)}}
          .bl-spin{animation:blSpin 0.8s linear infinite;display:inline-block}
          *{box-sizing:border-box}
          html,body{background:${t.bg};margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
          input[type=number]::-webkit-inner-spin-button{opacity:0.3}
          ::-webkit-scrollbar{width:5px;height:5px}
          ::-webkit-scrollbar-track{background:transparent}
          ::-webkit-scrollbar-thumb{background:${t.borderStrong};border-radius:99px}
          button{font-family:inherit}
          .bl-focusable{outline:none}
          .bl-focusable:focus-visible{box-shadow:0 0 0 3px ${t.focusRing};border-radius:9px}
          .bl-card-btn:focus-visible{box-shadow:0 0 0 3px ${t.focusRing} !important;border-color:${t.accent} !important;}
          a:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid ${t.accent};outline-offset:1px;}
          @media (prefers-reduced-motion: reduce){
            *,*::before,*::after{animation-duration:0.01ms !important;animation-iteration-count:1 !important;transition-duration:0.01ms !important;scroll-behavior:auto !important;}
          }
          @media (max-width:640px){
            .responsive-grid{grid-template-columns:1fr !important;gap:8px !important;}
            .part-row{grid-template-columns:1fr !important;gap:8px !important;}
          }
        `}</style>
        <ToastContainer toasts={toasts}/>

        {isDesktop?(
          <div style={{display:"flex",minHeight:"100vh"}}>
            {/* Sidebar — the desktop-width fix: this app was previously capped at a 740px column
                on every screen size, leaving most of a desktop viewport empty. A persistent
                sidebar plus a wider content column (below) is what actually uses that space. */}
            <nav aria-label="Primary" style={{width:232,flexShrink:0,borderRight:`1px solid ${t.border}`,background:t.bgElevated,
              display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh"}}>
              <div style={{padding:"20px 18px"}}><BrandMark t={t}/></div>
              <div style={{padding:"0 10px 10px"}}>
                <button onClick={()=>setSearchOpen(true)} className="bl-focusable" style={{width:"100%",display:"flex",alignItems:"center",gap:8,
                  background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 10px",cursor:"pointer",color:t.textFaint,
                  fontFamily:FONT_BODY,fontSize:12.5}}>
                  <Search size={14}/><span style={{flex:1,textAlign:"left"}}>Search…</span>
                  <span style={{fontSize:10,border:`1px solid ${t.border}`,borderRadius:4,padding:"1px 5px",fontFamily:FONT_MONO}}>⌘K</span>
                </button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:2,padding:"6px 10px",flex:1,overflowY:"auto"}}>
                {ALL_TABS.map(name=>{
                  const Icon=TAB_ICON[name];
                  const active=tab===name;
                  return (
                    <button key={name} onClick={()=>setTab(name)} aria-current={active?"page":undefined} className="bl-focusable"
                      style={{display:"flex",alignItems:"center",gap:11,padding:"10px 12px",borderRadius:9,border:"none",cursor:"pointer",
                        background:active?t.accentSoft:"transparent",color:active?t.accent:t.textMuted,fontSize:13.5,fontWeight:600,
                        fontFamily:FONT_BODY,textAlign:"left",transition:"background 0.12s,color 0.12s"}}
                      onMouseEnter={e=>{if(!active)e.currentTarget.style.background=t.surfaceHover;}}
                      onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent";}}>
                      <Icon size={17} strokeWidth={2}/>{name}
                    </button>
                  );
                })}
              </div>
              <div style={{padding:"14px 18px",borderTop:`1px solid ${t.border}`,display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5}}>
                  <span style={{color:t.textMuted}}>Parts</span>
                  <span style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text}}><AnimNum value={state.parts.length}/></span>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5}}>
                  <span style={{color:t.textMuted}}>Profit</span>
                  <span style={{fontFamily:FONT_MONO,fontWeight:700,color:t.positive}}>{fmt(totalProfit)}</span>
                </div>
                <SyncStatus saveStatus={saveStatus} t={t}/>
              </div>
            </nav>

            <main style={{flex:1,minWidth:0,overflowY:"auto"}}>
              <div style={{maxWidth:contentMaxWidth,margin:"0 auto",padding:"32px 32px 60px"}}>
                {panels}
              </div>
            </main>
          </div>
        ):(
          <>
            {/* Header */}
            <div style={{borderBottom:`1px solid ${t.border}`,padding:"calc(13px + env(safe-area-inset-top)) 16px 13px",background:t.bgElevated}}>
              <div style={{maxWidth:contentMaxWidth,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <BrandMark t={t} compact/>
                <div style={{display:"flex",gap:14,alignItems:"center",flexShrink:0}}>
                  <IconBtn icon={Search} label="Search (Ctrl/Cmd+K)" onClick={()=>setSearchOpen(true)} variant="surface" size={32} iconSize={15}/>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:9.5,color:t.textFaint,fontWeight:600}}>Parts</div>
                    <div style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text,fontSize:13}}><AnimNum value={state.parts.length}/></div>
                  </div>
                  <div style={{textAlign:"center"}}>
                    <div style={{fontSize:9.5,color:t.textFaint,fontWeight:600}}>Profit</div>
                    <div style={{fontFamily:FONT_MONO,fontWeight:700,color:t.positive,fontSize:13}}>{fmt(totalProfit)}</div>
                  </div>
                  <SyncStatus saveStatus={saveStatus} t={t} compact/>
                </div>
              </div>
            </div>

            {/* Tab bar — kept as a horizontally-scrolling top bar per preference, restyled with
                icons, a sliding underline, and no more of the max-width:640px font-shrink hack. */}
            <div role="tablist" aria-label="Sections" style={{borderBottom:`1px solid ${t.border}`,overflowX:"auto",background:t.bgElevated,WebkitOverflowScrolling:"touch"}}>
              <div style={{maxWidth:contentMaxWidth,margin:"0 auto",display:"flex"}}>
                {ALL_TABS.map(name=>{
                  const Icon=TAB_ICON[name];
                  const active=tab===name;
                  return (
                    <button key={name} role="tab" aria-selected={active} onClick={()=>setTab(name)} className="bl-focusable" style={{
                      display:"flex",alignItems:"center",gap:6,padding:"12px 13px",fontSize:12.5,fontWeight:600,border:"none",cursor:"pointer",background:"none",
                      whiteSpace:"nowrap",transition:"color 0.15s",flexShrink:0,fontFamily:FONT_BODY,
                      color:active?t.accent:t.textMuted,
                      borderBottom:`2px solid ${active?t.accent:"transparent"}`,
                    }}
                      onMouseEnter={e=>{if(!active)e.currentTarget.style.color=t.text;}}
                      onMouseLeave={e=>{if(!active)e.currentTarget.style.color=t.textMuted;}}>
                      <Icon size={14} strokeWidth={2.1}/>{name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{maxWidth:contentMaxWidth,margin:"0 auto",padding:"22px 16px calc(90px + env(safe-area-inset-bottom))"}}>
              {panels}
            </div>
          </>
        )}

        <QuickActionsFab state={state} dispatch={dispatch} toast={toast}/>
        <AIAgentChatbox state={state} dispatch={dispatch} setTab={setTab} setFormData={setFormData} toast={toast}/>
        <Lightbox url={lightboxUrl} onClose={()=>setLightboxUrl(null)}/>
        {searchOpen&&<GlobalSearchModal state={state} onClose={()=>setSearchOpen(false)} onJump={jumpTo}/>}
      </div>
    </ThemeCtx.Provider>
  );
}
