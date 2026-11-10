



import { useTheme } from "./theme.js";
import { useDialogA11y } from "../hooks/appHooks.js";

export function ModalShell({onClose,children,maxWidth=380,label,sheet=false,padding=22}) {
  const t=useTheme();
  const dialogRef=useDialogA11y(onClose,true);
  return (
    <div role="dialog" aria-modal="true" aria-label={label} style={{position:"fixed",inset:0,background:t.overlay,zIndex:1500,
      display:"flex",alignItems:sheet?"flex-end":"center",justifyContent:"center",padding:sheet?0:16}} onClick={onClose}>
      <div ref={dialogRef} tabIndex={-1} onClick={e=>e.stopPropagation()} style={{background:t.bgElevated,border:sheet?"none":`1px solid ${t.border}`,
        borderRadius:sheet?"18px 18px 0 0":16,padding:sheet?0:padding,width:"100%",maxWidth,
        maxHeight:sheet?"88vh":"90vh",overflowY:"auto",animation:sheet?"blSlideUp 0.22s cubic-bezier(0.22,1,0.36,1)":"blFadeUp 0.2s ease",
        outline:"none",boxShadow:t.shadow,paddingBottom:sheet?`calc(20px + env(safe-area-inset-bottom))`:padding}}>
        {sheet&&<div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px"}} aria-hidden="true">
          <div style={{width:38,height:4,borderRadius:99,background:t.borderStrong}}/>
        </div>}
        {children}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CONFIRM MODAL
═══════════════════════════════════════════ */
