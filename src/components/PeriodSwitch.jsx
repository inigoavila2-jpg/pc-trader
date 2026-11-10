



import { FONT_BODY, useTheme } from "./theme.js";

export function PeriodSwitch({period,setPeriod}) {
  const t=useTheme();
  const opts=[["month","This month"],["quarter","This quarter"],["all","All time"]];
  return (
    <div role="tablist" aria-label="Time period" style={{display:"inline-flex",background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:3,gap:2}}>
      {opts.map(([k,l])=>(
        <button key={k} role="tab" aria-selected={period===k} onClick={()=>setPeriod(k)} className="bl-focusable" style={{
          padding:"6px 12px",borderRadius:7,fontSize:12,fontWeight:600,cursor:"pointer",border:"none",fontFamily:FONT_BODY,
          background:period===k?t.accentStrong:"transparent", color:period===k?t.accentContrast:t.textMuted,
          transition:"all 0.15s"}}>{l}</button>
      ))}
    </div>
  );
}

