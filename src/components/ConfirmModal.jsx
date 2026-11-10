



import { FONT_DISPLAY, useTheme } from "./theme.js";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";

export function ConfirmModal({title,message,confirmLabel="Delete",danger=true,onConfirm,onCancel,extraChoices}) {
  const t=useTheme();
  return (
    <ModalShell onClose={onCancel} label={title}>
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:8,fontFamily:FONT_DISPLAY}}>{title}</div>
      <div style={{fontSize:13.5,color:t.textMuted,marginBottom:20,lineHeight:1.55}}>{message}</div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {extraChoices?extraChoices.map((c,i)=>(
          <Btn key={i} variant={c.variant||"warn"} onClick={c.onClick} style={{width:"100%"}}>{c.label}</Btn>
        )):(
          <Btn variant={danger?"danger":"primary"} onClick={onConfirm} style={{width:"100%"}}>{confirmLabel}</Btn>
        )}
        <Btn variant="ghost" onClick={onCancel} style={{width:"100%"}}>Cancel</Btn>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   CARD
═══════════════════════════════════════════ */
