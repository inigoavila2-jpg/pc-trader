import { useState } from "react";

import { StickyNote } from "lucide-react";

import { FONT_DISPLAY, FONT_BODY, useTheme } from "./theme.js";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { Dashboard } from "../pages/Dashboard.jsx";

export function QuickNoteModal({dispatch,toast,onClose}) {
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

