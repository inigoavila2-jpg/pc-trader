

import { Monitor } from "lucide-react";

import { FONT_DISPLAY } from "./theme.js";

export function BrandMark({t,compact}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
      <div style={{width:34,height:34,borderRadius:9,background:t.accentStrong,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
        <Monitor size={18} color={t.accentContrast} strokeWidth={2.25}/>
      </div>
      {!compact&&(
        <div style={{minWidth:0}}>
          <div style={{fontWeight:700,fontSize:15,color:t.text,letterSpacing:"-0.01em",whiteSpace:"nowrap",fontFamily:FONT_DISPLAY}}>PC Trader</div>
          <div style={{fontSize:9.5,color:t.textFaint,letterSpacing:"0.08em",whiteSpace:"nowrap",fontWeight:600}}>BUY · BUILD · SELL</div>
        </div>
      )}
    </div>
  );
}

