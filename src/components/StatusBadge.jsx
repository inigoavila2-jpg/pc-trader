



import { STATUS_TONE, FONT_BODY, useTheme } from "./theme.js";

export const STATUS_LABEL = { available:"Available", in_build:"In a build", sold:"Sold", defective:"Defective" };

export function StatusBadge({s}) {
  const t=useTheme();
  const tone=STATUS_TONE[s]||"neutral";
  const color=tone==="neutral"?t.textMuted:t[tone];
  const bg=tone==="neutral"?(t.mode==="dark"?"rgba(255,255,255,0.06)":"rgba(0,0,0,0.04)"):`${color}22`;
  const border=tone==="neutral"?t.border:`${color}55`;
  return (
    <span style={{background:bg,border:`1px solid ${border}`,color,fontSize:10.5,padding:"3px 8px",borderRadius:6,
      fontFamily:FONT_BODY,letterSpacing:"0.02em",fontWeight:700,whiteSpace:"nowrap",display:"inline-flex",alignItems:"center",gap:4}}>
      <span aria-hidden="true" style={{width:5,height:5,borderRadius:"50%",background:color,flexShrink:0}}/>
      {STATUS_LABEL[s]||s.replace("_"," ")}
    </span>
  );
}

/* ═══════════════════════════════════════════
   PHOTO UPLOAD / THUMB / LIGHTBOX — same upload+compression pipeline, restyled,
   with real labels on the icon-only controls and a 44px-plus tap target on the
   remove button (was 22px).
═══════════════════════════════════════════ */
