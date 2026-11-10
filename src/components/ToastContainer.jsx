

import { AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";

import { FONT_BODY, useTheme } from "./theme.js";
import { SR_ONLY } from "./SR_ONLY.jsx";

export const TOAST_ICON = { success:CheckCircle2, error:XCircle, info:Info, warn:AlertTriangle };

export function ToastContainer({toasts}) {
  const t=useTheme();
  return (
    <>
      <div aria-live="polite" role="status" style={SR_ONLY}>{toasts.map(x=>x.message).join(". ")}</div>
      <div aria-hidden="true" style={{position:"fixed",top:"calc(14px + env(safe-area-inset-top))",right:14,zIndex:9999,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none",maxWidth:"calc(100vw - 28px)"}}>
        {toasts.map(x=>{
          const tone=x.type==="success"?t.positive:x.type==="error"?t.negative:x.type==="warn"?t.warning:t.info;
          const Icon=TOAST_ICON[x.type]||Info;
          return (
            <div key={x.id} style={{
              background:t.bgElevated,border:`1px solid ${tone}55`,color:t.text,padding:"10px 14px",borderRadius:10,fontSize:13,fontWeight:500,
              maxWidth:320,animation:"blSlideIn 0.3s cubic-bezier(0.34,1.4,0.64,1)",fontFamily:FONT_BODY,
              display:"flex",alignItems:"center",gap:9,boxShadow:t.shadow
            }}>
              <Icon size={16} color={tone} strokeWidth={2.25} style={{flexShrink:0}}/>
              {x.message}
            </div>
          );
        })}
      </div>
    </>
  );
}
