import { useState } from "react";



import { FONT_BODY, useTheme } from "./theme.js";

export function Sel({label,children,style,...props}) {
  const t=useTheme();
  const [f,setF]=useState(false);
  return (
    <label style={{display:"flex",flexDirection:"column",gap:6,fontSize:13.5,color:t.textMuted,fontFamily:FONT_BODY,fontWeight:600}}>
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
