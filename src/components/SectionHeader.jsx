



import { FONT_DISPLAY, useTheme } from "./theme.js";

export function SectionHeader({icon:Icon,title,sub,action}){
  const t=useTheme();
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:sub?14:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
        {Icon&&<Icon size={16} strokeWidth={2} color={t.accent} style={{flexShrink:0}}/>}
        <div style={{minWidth:0}}>
          <div style={{fontSize:13.5,fontWeight:700,color:t.text,fontFamily:FONT_DISPLAY}}>{title}</div>
          {sub&&<div style={{fontSize:11.5,color:t.textFaint,marginTop:2}}>{sub}</div>}
        </div>
      </div>
      {action}
    </div>
  );
}

