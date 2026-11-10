



import { FONT_MONO, useTheme } from "./theme.js";

export function KPICard({label,value,question,color,accent}) {
  const t=useTheme();
  return (
    <div style={{background:t.surface,border:`1px solid ${accent||t.border}`,borderRadius:14,padding:"16px 18px",minWidth:0}}>
      <div style={{fontSize:11.5,color:t.textMuted,fontWeight:600,marginBottom:8}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,fontFamily:FONT_MONO,color:color||t.text,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{value}</div>
      {question&&<div style={{fontSize:11,color:t.textFaint,marginTop:7,lineHeight:1.4}}>{question}</div>}
    </div>
  );
}

