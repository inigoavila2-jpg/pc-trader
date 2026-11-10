

import { Wrench, Search, Check } from "lucide-react";
import { fmt } from "../data/model.js";
import { FONT_BODY, FONT_MONO, useTheme } from "./theme.js";
import { Inp } from "./Inp.jsx";

export function CategoryPartPicker({avail,categoriesPresent,activeCat,setActiveCat,search,setSearch,selectedIds,onToggle,selectedCountByCat}) {
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
