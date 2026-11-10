import { useState } from "react";



import { FONT_DISPLAY, useTheme } from "./theme.js";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { Inp } from "./Inp.jsx";

export function ReceiptPricePromptModal({buildName,onConfirm,onCancel}) {
  const t=useTheme();
  const [price,setPrice]=useState("");
  const submit=()=>{
    const n=parseFloat(price);
    if(!n||n<=0)return;
    onConfirm(n);
  };
  return (
    <ModalShell onClose={onCancel} label="Make a receipt" maxWidth={360}>
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:4,fontFamily:FONT_DISPLAY}}>Make a receipt</div>
      <div style={{fontSize:12,color:t.textMuted,marginBottom:16,lineHeight:1.5}}>
        "{buildName}" hasn't sold yet — enter the price you're quoting, and each part will be scaled proportionally to add up to it.
      </div>
      <Inp label="Input price (₱)" type="number" value={price} onChange={e=>setPrice(e.target.value)} placeholder="e.g. 32000" autoFocus/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={submit} disabled={!price||parseFloat(price)<=0} style={{flex:1}}>Generate</Btn>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   BUILD DETAIL SHEET
═══════════════════════════════════════════ */
