



import { FONT_BODY, useTheme } from "./theme.js";

export function Segmented({options,value,onChange,ariaLabel}) {
  const t=useTheme();
  return (
    <div role="tablist" aria-label={ariaLabel} style={{display:"inline-flex",background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:10,padding:3,gap:2,flexWrap:"wrap"}}>
      {options.map(([k,l,Icon])=>(
        <button key={k} role="tab" aria-selected={value===k} onClick={()=>onChange(k)} className="bl-focusable" style={{
          padding:"9px 16px",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer",border:"none",fontFamily:FONT_BODY,
          background:value===k?t.accentStrong:"transparent", color:value===k?t.accentContrast:t.textMuted,
          display:"inline-flex",alignItems:"center",gap:7,transition:"all 0.15s"}}>
          {Icon&&<Icon size={14} strokeWidth={2.25}/>}{l}
        </button>
      ))}
    </div>
  );
}
