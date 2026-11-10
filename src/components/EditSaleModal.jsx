import { useState } from "react";



import { FONT_DISPLAY, useTheme } from "./theme.js";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { Inp } from "./Inp.jsx";

export function EditSaleModal({sale,onClose,onSave}) {
  const t=useTheme();
  const [salePrice,setSalePrice]=useState(String(sale.salePrice));
  const [buyerName,setBuyerName]=useState(sale.buyerName||"");
  const [notes,setNotes]=useState(sale.notes||"");
  const [date,setDate]=useState(sale.date);
  return (
    <ModalShell onClose={onClose} label="Edit transaction" maxWidth={420}>
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:4,fontFamily:FONT_DISPLAY}}>Edit transaction</div>
      <div style={{fontSize:12,color:t.textFaint,marginBottom:16}}>{sale.name}</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <Inp label="Sale price (₱)" type="number" value={salePrice} onChange={e=>setSalePrice(e.target.value)}/>
        <Inp label="Buyer name" value={buyerName} onChange={e=>setBuyerName(e.target.value)}/>
        <Inp label="Sale date" value={date} onChange={e=>setDate(e.target.value)} placeholder="Jun 20, 2026"/>
        <Inp label="Notes" value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add a note about this sale"/>
        <div style={{fontSize:11,color:t.textFaint}}>Edits are logged with a timestamp for transparency.</div>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn onClick={()=>onSave({salePrice:parseFloat(salePrice)||sale.salePrice,buyerName,notes,date})} style={{flex:1}}>Save changes</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   RETURN REASON MODAL — used for Undo Sale
═══════════════════════════════════════════ */
