



import { FONT_MONO, useTheme } from "./theme.js";

export function HealthScoreRing({score,tier}) {
  const t=useTheme();
  const r=42, c=2*Math.PI*r;
  const filled=(score/100)*c;
  return (
    <div style={{display:"flex",alignItems:"center",gap:20,flexWrap:"wrap"}}>
      <svg width="100" height="100" viewBox="0 0 100 100" style={{flexShrink:0}} role="img" aria-label={`Financial health score ${score} out of 100, rated ${tier.label}`}>
        <circle cx="50" cy="50" r={r} fill="none" stroke={t.border} strokeWidth="8"/>
        <circle cx="50" cy="50" r={r} fill="none" stroke={tier.color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`} transform="rotate(-90 50 50)"
          style={{transition:"stroke-dasharray 0.8s cubic-bezier(0.34,1.2,0.64,1)"}}/>
        <text x="50" y="46" textAnchor="middle" fontSize="22" fontWeight="700" fill={t.text} fontFamily={FONT_MONO}>{score}</text>
        <text x="50" y="62" textAnchor="middle" fontSize="8" fill={t.textFaint}>/ 100</text>
      </svg>
      <div style={{flex:1,minWidth:160}}>
        <div style={{fontSize:15,fontWeight:700,color:tier.color,marginBottom:4}}>{tier.label}</div>
        <div style={{fontSize:12,color:t.textMuted,lineHeight:1.5}}>
          Composite of ROI, inventory turnover, cash position vs. baseline, and month-over-month profit momentum. A working diagnostic, not a credit score.
        </div>
      </div>
    </div>
  );
}

