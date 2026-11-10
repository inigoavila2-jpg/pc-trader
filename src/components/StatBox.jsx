



import { FONT_MONO, useTheme } from "./theme.js";

export function StatBox({label,value,sub,color}) {
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
