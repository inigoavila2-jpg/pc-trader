

import { ChevronDown, ChevronUp } from "lucide-react";

import { FONT_BODY, useTheme } from "./theme.js";

export function SortHeader({label,active,dir,onClick,align}) {
  const t=useTheme();
  return (
    <th style={{padding:0,textAlign:align||"left"}}>
      <button onClick={onClick} className="bl-focusable" aria-sort={active?(dir==="asc"?"ascending":"descending"):"none"}
        style={{cursor:"pointer",textAlign:align||"left",padding:"10px",userSelect:"none",whiteSpace:"nowrap",
          background:"none",border:"none",width:"100%",display:"flex",alignItems:"center",gap:3,
          justifyContent:align==="right"?"flex-end":"flex-start",fontFamily:FONT_BODY}}>
        <span style={{fontSize:10.5,color:active?t.text:t.textMuted,fontWeight:700}}>{label}</span>
        {active&&(dir==="asc"?<ChevronUp size={12} color={t.text}/>:<ChevronDown size={12} color={t.text}/>)}
      </button>
    </th>
  );
}
