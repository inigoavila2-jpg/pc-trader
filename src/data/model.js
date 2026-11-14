/* ═══════════════════════════════════════════
   GLOBALS & UTILS
═══════════════════════════════════════════ */
export const CURRENCY = "₱";
export const fmt = (n) => `${CURRENCY}${Number(n).toLocaleString("en-PH",{minimumFractionDigits:0,maximumFractionDigits:0})}`;
export const pct = (n) => `${(n*100).toFixed(1)}%`;
export const today = () => new Date().toLocaleDateString("en-PH",{year:"numeric",month:"short",day:"numeric"});
export const LEGACY_PREMIUM_LIGHT_COLORS = {
  bg:"#F4F2ED", bgElevated:"#FCFBF8", surface:"#FFFFFF", surfaceSunken:"#F0EEE8", surfaceHover:"#EAE7DF",
  border:"#DED9CE", borderStrong:"#C7BFAF", text:"#252821", textMuted:"#596158", textFaint:"#70766D",
  accent:"#B7823E", accentStrong:"#795522", accentContrast:"#FFFFFF", info:"#337184", infoStrong:"#245766",
  positive:"#23734D", positiveStrong:"#18583A", negative:"#B4423C", negativeStrong:"#91322E", warning:"#94611F",
};
export const PREMIUM_LIGHT_COLORS = {
  bg:"#F4F6F8", bgElevated:"#FFFFFF", surface:"#FFFFFF", surfaceSunken:"#F1F3F5", surfaceHover:"#E9EDF2",
  border:"#DCE2E8", borderStrong:"#BBC5D0", text:"#18212B", textMuted:"#4B5867", textFaint:"#596777",
  accent:"#252A31", accentStrong:"#15191F", accentContrast:"#FFFFFF", info:"#46505D", infoStrong:"#333B45",
  positive:"#23734D", positiveStrong:"#18583A", negative:"#B4423C", negativeStrong:"#91322E", warning:"#94611F",
};
let _id = Date.now();
export const uid = () => `id_${_id++}`;
export const CATEGORIES = ["GPU","CPU","Motherboard","CPU+MB","RAM","PSU","Storage","Cooler","Case","Monitor","Mouse","Keyboard","Other"];

export const categoryKey = (name) => String(name || "").trim().toLowerCase().replace(/\s+/g," ");
export const findBuiltInCategory = (name) => CATEGORIES.find(c => categoryKey(c) === categoryKey(name));
export const findCustomCategory = (name, customCategories=[]) => (customCategories||[]).find(c => categoryKey(c?.name) === categoryKey(name));


// Every built-in category is a PC part by definition. Custom categories (added via the
// "+ Add Category" picker) carry their own domain in state.customCategories, looked up at
// render/dispatch time rather than re-derived from the category name string.
export function domainOf(category, customCategories){
  if(findBuiltInCategory(category))return "pc_part";
  const custom=findCustomCategory(category,customCategories);
  return custom?custom.domain:"pc_part";
}
export const initialState = { bundles:[], parts:[], builds:[], sales:[], settings:{ targetMargin:30 }, customCategories:[], quickNotes:[], hiddenCategories:[], businessCash:14500, cashOnHand:0, personalCash:0, expenses:[], transactions:[], netWorthSnapshots:[], outstandingReceivables:0, totalDebt:0, themeMode:"light", activeThemeSlot:3, themePaletteSlots:{2:null,3:{name:"Premium Light",mode:"light",colors:PREMIUM_LIGHT_COLORS},4:null,5:null}, premiumLightThemeSeeded:true };

// New account model: businessCash is retained as the storage field for Business Bank.
// cashOnHand is physical cash. Legacy personal records remain stored but are hidden from UI.
export const normalizeAccount = (value) => {
  if (value === "cash" || value === "cash_on_hand") return "cash";
  if (value === "personal") return "cash"; // compatibility for old UI/AI actions; never create personal records
  return "bank";
};
export const accountLabel = (value) => normalizeAccount(value) === "cash" ? "Cash" : "Business Bank";
export const getAccountBalance = (state, value) => normalizeAccount(value) === "cash"
  ? Number(state?.cashOnHand || 0) : Number(state?.businessCash || 0);
export const withAccountDelta = (state, value, delta) => normalizeAccount(value) === "cash"
  ? { ...state, cashOnHand: Number(state?.cashOnHand || 0) + Number(delta || 0) }
  : { ...state, businessCash: Number(state?.businessCash || 0) + Number(delta || 0) };

// Historical financial snapshots are the source of truth for net-worth-over-time analysis.
// One snapshot is kept per local calendar day; when the business changes during the day,
// that day's snapshot is replaced with the newest state. This keeps the history compact while
// still ensuring that a daily snapshot always reflects the latest business position.
export const localISODate = (date=new Date()) => {
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
};

export const calculateNetWorthSnapshot = (state, date=localISODate()) => {
  const parts=Array.isArray(state?.parts)?state.parts:[];
  const activeInventory=parts.filter(p=>p.status==='available'||p.status==='in_build');
  const inventoryMarketValue=activeInventory.reduce((sum,p)=>{
    const market=Number(p?.marketValue||0);
    const cost=Number(p?.allocatedCost||0);
    return sum+(market>0?market:cost);
  },0);
  const inventoryCost=activeInventory.reduce((sum,p)=>sum+Number(p?.allocatedCost||0),0);
  const businessCash=Number(state?.businessCash||0);
  const cashOnHand=Number(state?.cashOnHand||0);
  const totalLiquid=businessCash+cashOnHand;
  const outstandingReceivables=Number(state?.outstandingReceivables||0);
  const totalDebt=Number(state?.totalDebt||0);
  const netWorth=totalLiquid+inventoryMarketValue+outstandingReceivables-totalDebt;

  return {
    id:`nw_${date}`,
    date,
    capturedAt:new Date().toISOString(),
    businessCash,
    cashOnHand,
    totalLiquid,
    inventoryCost,
    inventoryMarketValue,
    outstandingReceivables,
    totalDebt,
    netWorth,
    activeInventoryCount:activeInventory.length,
  };
};

export const recordNetWorthSnapshot = (state) => {
  const snapshot=calculateNetWorthSnapshot(state);
  const existing=Array.isArray(state?.netWorthSnapshots)?state.netWorthSnapshots:[];
  const next=[...existing.filter(s=>s.date!==snapshot.date),snapshot]
    .sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  return {...state,netWorthSnapshots:next};
};

export function normalizeCategoryRegistry(state){
  const hidden=[...(state.hiddenCategories||[])].map(String);
  const custom=[...(state.customCategories||[])].filter(c=>c?.name).map(c=>({...c,name:String(c.name).trim().replace(/\s+/g," "),domain:c.domain==="general"?"general":"pc_part"}));
  const seen=new Set(custom.map(c=>categoryKey(c.name)));
  const hiddenKeys=new Set(hidden.map(categoryKey));
  for(const part of (state.parts||[])){
    const name=String(part?.category||"").trim().replace(/\s+/g," ");
    if(!name || findBuiltInCategory(name) || hiddenKeys.has(categoryKey(name)) || seen.has(categoryKey(name))) continue;
    custom.push({name,domain:"general"});
    seen.add(categoryKey(name));
  }
  return {...state,customCategories:custom,hiddenCategories:[...new Set(hidden.map(h=>findBuiltInCategory(h)||h))]};
}

export const SNAPSHOT_ACTIONS = new Set([
  'ADD_BUNDLE','ADD_PARTS','UPDATE_PART','SELL','ADD_EXPENSE','ADD_INCOME','TRANSFER_FUNDS',
  'UPDATE_LIQUID_CASH','UNDO_SALE','DELETE_SALE','DELETE_PART','DUPLICATE_PART','DELETE_BUILD',
  'DELETE_BUNDLE','MARK_DEFECTIVE'
]);

/* ═══════════════════════════════════════════
   REDUCER
═══════════════════════════════════════════ */
