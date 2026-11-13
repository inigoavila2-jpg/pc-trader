



import { FONT_DISPLAY, useTheme } from "./theme.js";

export function PageHeader({title,sub,action}){
  const t=useTheme();
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}>
      <div>
        <h2 style={{color:t.text,fontSize:24,fontWeight:700,margin:0,fontFamily:FONT_DISPLAY,letterSpacing:"-0.01em",lineHeight:1.2}}>{title}</h2>
        {sub&&<p style={{color:t.textMuted,fontSize:14,lineHeight:1.5,margin:"7px 0 0",maxWidth: "65ch"}}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* ═══════════════════════════════════════════
   DEAL BAR — visual read on "market value vs. what you paid"
═══════════════════════════════════════════ */
