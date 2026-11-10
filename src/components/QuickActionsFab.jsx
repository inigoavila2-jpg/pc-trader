import { useState, useEffect } from "react";

import { ShoppingCart, Plus, Zap, StickyNote } from "lucide-react";

import { useTheme } from "./theme.js";
import { QuickBuyModal } from "./QuickBuyModal.jsx";
import { QuickSellPickerModal } from "./QuickSellPickerModal.jsx";
import { QuickNoteModal } from "./QuickNoteModal.jsx";

export function QuickActionsFab({state,dispatch,toast}) {
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

