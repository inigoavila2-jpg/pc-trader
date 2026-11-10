

import { X } from "lucide-react";

import { useTheme } from "./theme.js";
import { useDialogA11y } from "../hooks/appHooks.js";

export function Lightbox({url,onClose}) {
  const t=useTheme();
  const active=!!url;
  const dialogRef=useDialogA11y(onClose,active);
  if(!url)return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Photo" ref={dialogRef} tabIndex={-1}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:20,animation:"blFadeUp 0.15s ease",outline:"none"}}
      onClick={onClose}>
      <img src={url} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",borderRadius:8,boxShadow:"0 20px 60px rgba(0,0,0,0.7)"}}/>
      <button onClick={onClose} aria-label="Close" className="bl-focusable" style={{position:"absolute",top:18,right:18,width:40,height:40,borderRadius:"50%",
        background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",cursor:"pointer",
        display:"flex",alignItems:"center",justifyContent:"center"}}>
        <X size={18}/>
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MODAL SHELL — shared chrome (backdrop, focus trap, Escape, aria-modal) for
   every dialog and bottom sheet in the app, so each modal only has to describe
   its own content, not re-solve accessibility.
═══════════════════════════════════════════ */
