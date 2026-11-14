
import { useEffect } from "react";
import { X } from "lucide-react";
import { useTheme } from "./theme.js";
import { useDialogA11y } from "../hooks/appHooks.js";

let openModalCount=0;
let lockedScrollY=0;
let bodyStyles;

export function ModalShell({onClose,children,maxWidth=380,label,sheet=false,padding=22}) {
  const t=useTheme();
  const dialogRef=useDialogA11y(onClose,true);
  useEffect(()=>{
    const body=document.body;
    if(openModalCount===0){
      lockedScrollY=window.scrollY;
      bodyStyles={position:body.style.position,top:body.style.top,left:body.style.left,right:body.style.right,width:body.style.width,overflow:body.style.overflow};
      Object.assign(body.style,{position:"fixed",top:`-${lockedScrollY}px`,left:"0",right:"0",width:"100%",overflow:"hidden"});
    }
    openModalCount++;
    return()=>{
      openModalCount=Math.max(0,openModalCount-1);
      if(openModalCount===0){
        Object.assign(body.style,bodyStyles);
        window.scrollTo(0,lockedScrollY);
      }
    };
  },[]);
  return (
    <div role="dialog" aria-modal="true" aria-label={label} style={{position:"fixed",inset:0,background:t.overlay,zIndex:1500,
      display:"flex",alignItems:sheet?"flex-end":"center",justifyContent:"center",padding:sheet?0:16}} onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} onClick={e=>e.stopPropagation()} style={{background:t.bgElevated,border:sheet?"none":`1px solid ${t.border}`,
        borderRadius:sheet?"18px 18px 0 0":16,padding:sheet?0:padding,width:"100%",maxWidth,
        maxHeight:sheet?"88dvh":"90vh",overflowY:"auto",overscrollBehaviorY:"contain",WebkitOverflowScrolling:"touch",touchAction:"pan-y",animation:sheet?"blSlideUp 0.22s cubic-bezier(0.22,1,0.36,1)":"blFadeUp 0.2s ease",
        outline:"none",boxShadow:t.shadow,paddingBottom:sheet?`calc(20px + env(safe-area-inset-bottom))`:padding}}>
        {sheet&&<div style={{position:"sticky",top:0,zIndex:2,height:40,display:"flex",justifyContent:"center",alignItems:"center",background:t.bgElevated}}>
          <div aria-hidden="true" style={{width:38,height:4,borderRadius:99,background:t.borderStrong}}/>
          <button type="button" onClick={onClose} aria-label={`Close ${label}`} className="bl-focusable"
            style={{position:"absolute",right:6,top:0,width:40,height:40,display:"grid",placeItems:"center",border:0,borderRadius:20,background:"transparent",color:t.textMuted,cursor:"pointer"}}>
            <X size={19}/>
          </button>
        </div>}
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CONFIRM MODAL
═══════════════════════════════════════════ */
