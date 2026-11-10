import { useState } from "react";

import { Wrench, Check, Copy, ClipboardCopy } from "lucide-react";
import { fmt } from "../data/model.js";
import { FONT_DISPLAY, FONT_MONO, useTheme } from "./theme.js";
import { PhotoThumb } from "./PhotoThumb.jsx";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";

export function ReceiptModal({title,subtitle,date,total,label,receiptRows,onClose}) {
  const t=useTheme();
  const [copied,setCopied]=useState(false);

  const copyReceipt=()=>{
    const lines=[
      title,
      "",
      ...receiptRows.map(p=>`${p.name}: ${fmt(p.scaledPrice)}`),
      "",
      `Total: ${fmt(total)}`,
    ];
    const text=lines.join("\n");
    navigator.clipboard?.writeText(text).then(
      ()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);},
      ()=>{}
    );
  };

  return (
    <ModalShell onClose={onClose} label={label||"Sales receipt"} maxWidth={400} padding={0}>
      <div style={{padding:"20px 22px 16px",borderBottom:`1px solid ${t.border}`}}>
        <div style={{color:t.textFaint,fontSize:11,fontWeight:600,marginBottom:5}}>{label||"Sales receipt"}</div>
        <div style={{color:t.text,fontWeight:700,fontSize:17,fontFamily:FONT_DISPLAY}}>{title}</div>
        {subtitle&&<div style={{color:t.textMuted,fontSize:12,marginTop:3}}>{subtitle}</div>}
        {date&&<div style={{color:t.textFaint,fontSize:11,marginTop:2}}>{date}</div>}
      </div>

      <div style={{padding:"16px 22px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:11,marginBottom:14}}>
          {receiptRows.map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:10}}>
              {p.photoUrl?(
                <PhotoThumb url={p.photoUrl} size={34} seed={p.id.length}/>
              ):(
                <div style={{width:34,height:34,flexShrink:0,borderRadius:7,background:t.surfaceSunken,border:`1px solid ${t.border}`,
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Wrench size={14} strokeWidth={1.5} color={t.textFaint}/>
                </div>
              )}
              <span style={{flex:1,color:t.text,fontSize:13.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
              <span style={{fontFamily:FONT_MONO,fontSize:14,color:t.text,fontWeight:600,flexShrink:0}}>{fmt(p.scaledPrice)}</span>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:14,borderTop:`1px solid ${t.border}`}}>
          <span style={{color:t.text,fontWeight:700,fontSize:15}}>Total</span>
          <span style={{fontFamily:FONT_MONO,fontWeight:800,fontSize:19,color:t.text}}>{fmt(total)}</span>
        </div>
      </div>

      <div style={{padding:"0 22px 22px",display:"flex",flexDirection:"column",gap:8}}>
        <Btn icon={copied?Check:ClipboardCopy} onClick={copyReceipt} style={{width:"100%"}}>{copied?"Copied":"Copy receipt text"}</Btn>
        <Btn variant="ghost" onClick={onClose} style={{width:"100%"}}>Close</Btn>
      </div>
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   EDIT SALE MODAL
═══════════════════════════════════════════ */
