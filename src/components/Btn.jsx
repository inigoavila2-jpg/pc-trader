import { useState } from "react";

import { Loader2 } from "lucide-react";

import { FONT_BODY, useTheme } from "./theme.js";

export function Btn({children,variant="primary",onClick,disabled=false,loading=false,small=false,icon:Icon,style={},type="button",...rest}) {
  const t=useTheme();
  const [pressed,setPressed]=useState(false);
  const VC={
    primary:{bg:t.accentStrong,hov:t.accent,txt:t.accentContrast,bdr:"transparent"},
    ghost:{bg:t.surfaceHover,hov:t.borderStrong,txt:t.text,bdr:t.border},
    danger:{bg:t.negativeSoft,hov:`${t.negative}33`,txt:t.negative,bdr:t.negativeSoftBorder},
    success:{bg:t.positiveStrong,hov:t.positive,txt:"#fff",bdr:"transparent"},
    warn:{bg:t.warningSoft,hov:`${t.warning}33`,txt:t.warning,bdr:t.warningSoftBorder},
    info:{bg:t.infoSoft,hov:`${t.info}33`,txt:t.info,bdr:t.infoSoftBorder},
  };
  const c=VC[variant]||VC.primary;
  return (
    <button
      type={type}
      onClick={()=>{if(!disabled&&!loading){setPressed(true);setTimeout(()=>setPressed(false),100);onClick&&onClick();}}}
      disabled={disabled||loading}
      className="bl-focusable"
      onMouseEnter={e=>{if(!disabled)e.currentTarget.style.background=c.hov;}}
      onMouseLeave={e=>{e.currentTarget.style.background=c.bg;}}
      style={{background:c.bg,color:disabled?t.textFaint:c.txt,border:`1px solid ${c.bdr}`,borderRadius:9,
        padding:small?"7px 12px":"10px 17px",fontSize:small?12:13.5,fontWeight:600,cursor:disabled?"not-allowed":"pointer",
        fontFamily:FONT_BODY,minHeight:small?32:44,
        transition:"background 0.12s,transform 0.1s",transform:pressed?"scale(0.96)":"scale(1)",opacity:disabled?0.5:1,
        display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,...style}} {...rest}>
      {loading?<Loader2 size={small?13:15} className="bl-spin"/>:Icon?<Icon size={small?14:16} strokeWidth={2.25}/>:null}
      {children}
    </button>
  );
}

/* Icon-only button — every icon-only control in the app now gets a real
   accessible name and a floor of 40px so it clears the touch-target guideline. */
