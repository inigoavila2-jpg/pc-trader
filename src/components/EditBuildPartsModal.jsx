import { useState } from "react";


import { fmt, CATEGORIES, categoryKey, domainOf } from "../data/model.js";
import { FONT_DISPLAY, FONT_MONO, useTheme } from "./theme.js";
import { PhotoThumb } from "./PhotoThumb.jsx";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { SectionHeader } from "./SectionHeader.jsx";
import { CategoryPartPicker } from "./CategoryPartPicker.jsx";

export function EditBuildPartsModal({build,state,dispatch,toast,onClose}) {
  const t=useTheme();
  const currentParts=state.parts.filter(p=>build.partIds.includes(p.id));
  const [toRemove,setToRemove]=useState([]); // partIds staged for removal (not yet dispatched)
  const [toAdd,setToAdd]=useState([]); // partIds staged for adding
  const [activeCat,setActiveCat]=useState(null);
  const [pickerSearch,setPickerSearch]=useState("");

  // Same Domain Firewall as build creation — only PC Parts, never General Assets.
  const avail=state.parts.filter(p=>p.status==="available"&&domainOf(p.category,state.customCategories)==="pc_part");
  const hiddenKeys=new Set((state.hiddenCategories||[]).map(categoryKey));
  const customPcPartCats=(state.customCategories||[]).filter(c=>c.domain==="pc_part"&&!hiddenKeys.has(categoryKey(c.name))).map(c=>c.name);
  const categoriesPresent=[...CATEGORIES.filter(c=>!hiddenKeys.has(categoryKey(c))),...customPcPartCats].filter(c=>avail.some(p=>p.category===c));
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
