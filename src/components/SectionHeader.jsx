



import { FONT_DISPLAY, useTheme } from "./theme.js";

export function SectionHeader({icon:Icon,title,sub,action}){
  const t=useTheme();
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:sub?14:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
        {Icon&&<Icon size={16} strokeWidth={2} color={t.accent} style={{flexShrink:0}}/>}
        <div style={{minWidth:0}}>
          <h2 style={{fontSize:14,fontWeight:700,color:t.text,fontFamily:FONT_DISPLAY,lineHeight:1.35,margin:0}}>{title}</h2>
          {sub&&<div style={{fontSize:12,color:t.textMuted,marginTop:3,lineHeight:1.45}}>{sub}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

