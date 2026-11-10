import { useState } from "react";

import { AlertTriangle } from "lucide-react";
import { fmt } from "../data/model.js";
import { FONT_DISPLAY, useTheme } from "./theme.js";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { Inp } from "./Inp.jsx";
import { Dashboard } from "../pages/Dashboard.jsx";

export function DefectiveModal({part,onConfirm,onCancel}) {
  const t=useTheme();
  const [reason,setReason]=useState("");
  return (
    <ModalShell onClose={onCancel} label="Mark as defective">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:8,fontFamily:FONT_DISPLAY}}>Mark as defective?</div>
      <div style={{fontSize:13,color:t.textMuted,marginBottom:14,lineHeight:1.55}}>
        "{part.name}" will be removed from active inventory and logged as a capital loss of <b style={{color:t.negative}}>{fmt(part.allocatedCost)}</b> on your Dashboard.
      </div>
      <Inp label="Reason (optional)" value={reason} onChange={e=>setReason(e.target.value)} placeholder="DOA, shorted during build, etc."/>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:16}}>
        <Btn variant="warn" icon={AlertTriangle} onClick={()=>onConfirm(reason)} style={{width:"100%"}}>Mark defective — log loss</Btn>
        <Btn variant="ghost" onClick={onCancel} style={{width:"100%"}}>Cancel</Btn>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   QUICK SELL MODAL
═══════════════════════════════════════════ */
