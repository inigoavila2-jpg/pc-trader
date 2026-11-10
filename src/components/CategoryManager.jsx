import { useState } from "react";

import { Plus, Tag } from "lucide-react";
import { CATEGORIES, categoryKey, findBuiltInCategory, findCustomCategory } from "../data/model.js";
import { FONT_DISPLAY, FONT_BODY, useTheme } from "./theme.js";
import { ModalShell } from "./ModalShell.jsx";
import { ConfirmModal } from "./ConfirmModal.jsx";
import { Btn } from "./Btn.jsx";
import { Buy } from "../pages/Buy.jsx";
import { Inventory } from "../pages/Inventory.jsx";
import { History } from "../pages/History.jsx";

export function CategoryManager({state,dispatch,toast,onClose}) {
  const t=useTheme();
  const [adding,setAdding]=useState(false);
  const [newName,setNewName]=useState("");
  const [newDomain,setNewDomain]=useState("general");
  const [pendingRemove,setPendingRemove]=useState(null);
  const hiddenKeys=new Set((state.hiddenCategories||[]).map(categoryKey));
  const custom=(state.customCategories||[]).filter(c=>c?.name);
  const usedCategoryNames=[...new Set((state.parts||[]).map(p=>String(p.category||"").trim()).filter(Boolean))];
  const activeBuiltIns=CATEGORIES.filter(c=>!hiddenKeys.has(categoryKey(c)));
  const removedBuiltIns=CATEGORIES.filter(c=>hiddenKeys.has(categoryKey(c)));
  const legacyCustom=usedCategoryNames.filter(name=>!findBuiltInCategory(name) && !findCustomCategory(name,custom) && !hiddenKeys.has(categoryKey(name)));

  const doAdd=()=>{
    const name=newName.trim().replace(/\s+/g," ");
    if(!name)return;
    const key=categoryKey(name);
    const built=findBuiltInCategory(name);
    const exists=activeBuiltIns.some(c=>categoryKey(c)===key) || removedBuiltIns.some(c=>categoryKey(c)===key) || custom.some(c=>categoryKey(c.name)===key) || legacyCustom.some(c=>categoryKey(c)===key);
    if(exists){ toast("That category already exists", "error"); return; }
    dispatch({type:"ADD_CATEGORY",name,domain:newDomain});
    toast(`Added category "${name}"`);
    setNewName("");setNewDomain("general");setAdding(false);
  };

  const removeNow=(name)=>{
    dispatch({type:"REMOVE_CATEGORY",name});
    toast(`Removed "${name}" — existing items moved to Other`,'warn');
    setPendingRemove(null);
  };

  const addExistingBuiltIn=(name)=>{
    dispatch({type:"ADD_CATEGORY",name});
    toast(`Restored "${name}"`,'success');
  };

  return (
    <ModalShell onClose={onClose} label="Manage categories" maxWidth={500} sheet>
      <div style={{fontWeight:700,fontSize:18,color:t.text,fontFamily:FONT_DISPLAY}}>Manage categories</div>
      <div style={{fontSize:12,color:t.textMuted,marginTop:4,marginBottom:16}}>Add, remove, or restore categories used by Buy and Inventory.</div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:8}}>
        <div style={{fontSize:12,color:t.textMuted,fontWeight:700}}>Active categories ({activeBuiltIns.length+custom.length+legacyCustom.length})</div>
        <Btn small icon={Plus} onClick={()=>setAdding(v=>!v)}>{adding?"Cancel":"Add category"}</Btn>
      </div>

      {adding&&(
        <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:10,padding:12,marginBottom:12,display:"flex",flexDirection:"column",gap:8}}>
          <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')doAdd();}} placeholder="e.g. iPhone, Motorcycle, Webcam"
            style={{background:t.surface,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 10px",color:t.text,fontSize:13,fontFamily:FONT_BODY,outline:"none"}}/>
          <div style={{display:"flex",gap:6}}>
            {[['pc_part','PC part'],['general','General asset']].map(([v,l])=>(
              <button key={v} type="button" onClick={()=>setNewDomain(v)} className="bl-focusable"
                style={{flex:1,padding:"7px 8px",borderRadius:8,fontSize:11.5,fontWeight:600,cursor:"pointer",fontFamily:FONT_BODY,
                  background:newDomain===v?t.accentSoft:t.surface,border:`1px solid ${newDomain===v?t.accentSoftBorder:t.border}`,color:newDomain===v?t.accent:t.textMuted}}>{l}</button>
            ))}
          </div>
          <Btn onClick={doAdd} disabled={!newName.trim()}>Add category</Btn>
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:440,overflowY:"auto",paddingRight:2}}>
        {activeBuiltIns.map(name=>(
          <div key={`builtin-${name}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:9,background:t.surfaceSunken,border:`1px solid ${t.border}`}}>
            <Tag size={15} color={t.textFaint}/><div style={{flex:1,color:t.text,fontSize:13}}>{name}</div>
            {name!=="Other"?<Btn small variant="danger" onClick={()=>setPendingRemove(name)}>Remove</Btn>:<span style={{fontSize:10.5,color:t.textFaint}}>Fallback</span>}
          </div>
        ))}
        {custom.map(c=>(
          <div key={`custom-${c.name}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:9,background:t.surfaceSunken,border:`1px solid ${t.border}`}}>
            <Tag size={15} color={t.accent}/><div style={{flex:1,minWidth:0}}><div style={{color:t.text,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div><div style={{fontSize:10.5,color:t.textFaint}}>{c.domain==="general"?"General asset":"PC part"}</div></div>
            <Btn small variant="danger" onClick={()=>setPendingRemove(c.name)}>Remove</Btn>
          </div>
        ))}
        {legacyCustom.map(name=>(
          <div key={`legacy-${name}`} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 10px",borderRadius:9,background:t.surfaceSunken,border:`1px solid ${t.border}`}}>
            <Tag size={15} color={t.accent}/><div style={{flex:1,color:t.text,fontSize:13}}>{name}</div><span style={{fontSize:10.5,color:t.textFaint}}>Recovered from inventory</span><Btn small variant="danger" onClick={()=>setPendingRemove(name)}>Remove</Btn>
          </div>
        ))}
      </div>

      {removedBuiltIns.length>0&&(
        <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${t.border}`}}>
          <div style={{fontSize:12,color:t.textMuted,fontWeight:700,marginBottom:8}}>Removed built-ins</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {removedBuiltIns.map(name=><Btn key={name} small variant="ghost" onClick={()=>addExistingBuiltIn(name)}>{name} · Restore</Btn>)}
          </div>
        </div>
      )}

      <div style={{marginTop:16,display:"flex",justifyContent:"flex-end"}}><Btn variant="ghost" onClick={onClose}>Done</Btn></div>
      {pendingRemove&&<ConfirmModal title={`Remove “${pendingRemove}”?`} message={`Any existing inventory items in “${pendingRemove}” will automatically move to “Other”. This cannot be undone for the category assignment.`} onConfirm={()=>removeNow(pendingRemove)} onCancel={()=>setPendingRemove(null)}/>}\n    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   STAT BOX — small metric tile used in History's analytics grid
═══════════════════════════════════════════ */
