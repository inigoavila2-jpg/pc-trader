



import { FONT_MONO, useTheme } from "./theme.js";
import { Buy } from "../pages/Buy.jsx";
import { Sell } from "../pages/Sell.jsx";

export function DealBar({score}) {
  const t=useTheme();
  const pctv=Math.min(100,Math.max(0,(score/2)*100));
  const tone=score>=1.3?t.positive:score>=1?t.info:t.negative;
  const verdict=score>=1.3?"Great deal":score>=1?"Fair deal":"Below market";
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:11.5,marginBottom:6}}>
        <span style={{color:tone,fontWeight:700}}>{verdict}</span>
        <span style={{color:t.textMuted,fontFamily:FONT_MONO}}>{score.toFixed(2)}×</span>
      </div>
      <div style={{height:6,background:t.surfaceSunken,borderRadius:99,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pctv}%`,background:tone,borderRadius:99,transition:"width 0.6s cubic-bezier(0.34,1.2,0.64,1)"}}/>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SEGMENTED — reusable pill toggle (Buy's Bundle/Single, Sell's mode switch, etc.)
   so every mode toggle in the app shares one visual language instead of each
   screen inventing its own button-pair styling.
═══════════════════════════════════════════ */
