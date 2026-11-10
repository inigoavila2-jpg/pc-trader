import { useState } from "react";

import { Banknote, Check, Wallet } from "lucide-react";
import { fmt, pct } from "../data/model.js";
import { FONT_DISPLAY, FONT_MONO, useTheme } from "./theme.js";
import { usePersistentState } from "../hooks/appHooks.js";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { Inp } from "./Inp.jsx";
import { Segmented } from "./Segmented.jsx";

export function QuickSellModal({part,onClose,onConfirm,targetMargin}) {
  const t=useTheme();
  const suggested = Math.round(part.allocatedCost * (1 + targetMargin/100));
  const [price,setPrice]=useState(String(suggested));
  const [buyer,setBuyer]=useState("");
  const [paymentAccount,setPaymentAccount]=usePersistentState("pctrader:lastSaleAccount","bank");
  const sp=parseFloat(price)||0;
  const profit=sp-part.allocatedCost;
  const m=part.allocatedCost>0?profit/part.allocatedCost:0;
  return (
    <ModalShell onClose={onClose} label="Quick sell">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:4,fontFamily:FONT_DISPLAY}}>Quick sell</div>
      <div style={{fontSize:13,color:t.textFaint,marginBottom:16}}>{part.name} · cost {fmt(part.allocatedCost)}</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <Inp label={`Sale price (₱) — suggested ${fmt(suggested)} at ${targetMargin}% margin`} type="number" value={price} onChange={e=>setPrice(e.target.value)} />
        <div><div style={{fontSize:12.5,color:t.textMuted,fontWeight:500,marginBottom:6}}>Receive payment into</div><Segmented ariaLabel="Receive payment into" value={paymentAccount} onChange={setPaymentAccount} options={[["bank","Business Bank",Wallet],["cash","Cash",Banknote]]}/></div>
        <Inp label="Buyer name (optional)" value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="Juan dela Cruz" />
        {sp>0&&(
          <div style={{background:t.surfaceSunken,borderRadius:9,padding:12,border:`1px solid ${t.border}`}}>
            {[["Profit",`${profit>=0?"+":""}${fmt(profit)}`,profit>=0?t.positive:t.negative],
              ["Margin",pct(m),profit>=0?t.positive:t.negative]].map(([l,v,c])=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                <span style={{color:t.textMuted}}>{l}</span>
                <span style={{fontFamily:FONT_MONO,fontWeight:700,color:c}}>{v}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn variant="success" icon={Check} onClick={()=>onConfirm(sp,buyer,paymentAccount)} disabled={!sp} style={{flex:1}}>Confirm sale</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   EDIT PART MODAL
═══════════════════════════════════════════ */
