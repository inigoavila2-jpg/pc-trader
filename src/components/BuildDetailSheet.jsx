import { useState } from "react";

import { Trash2, Pencil, Copy, Receipt, ClipboardList, Undo2, Monitor } from "lucide-react";
import { fmt, today } from "../data/model.js";
import { FONT_DISPLAY, FONT_MONO, useTheme } from "./theme.js";
import { PhotoThumb } from "./PhotoThumb.jsx";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { DetailRow } from "./DetailRow.jsx";
import { ReceiptPricePromptModal } from "./ReceiptPricePromptModal.jsx";
import { ReceiptModal } from "./ReceiptModal.jsx";

export function BuildDetailSheet({build,parts,onClose,openLightbox,onDissolve,onCopySpecs,onDelete,onEdit}) {
  const t=useTheme();
  const [showReceiptPrompt,setShowReceiptPrompt]=useState(false);
  const [buildReceipt,setBuildReceipt]=useState(null); // {rows,total} once a price has been entered
  const cost=parts.reduce((s,p)=>s+p.allocatedCost,0);
  const market=parts.reduce((s,p)=>s+p.marketValue,0);
  const potential=market-cost;

  const generateBuildReceipt=(inputPrice)=>{
    const totalMarket=parts.reduce((s,p)=>s+(p.marketValue||0),0);
    const rows=parts.map(p=>{
      const share=totalMarket>0?(p.marketValue||0)/totalMarket:(parts.length?1/parts.length:0);
      return {...p,scaledPrice:share*inputPrice};
    });
    setBuildReceipt({rows,total:inputPrice});
    setShowReceiptPrompt(false);
  };

  return (
    <ModalShell onClose={onClose} label={build.name} sheet maxWidth={520} padding={0}>
      <div style={{width:"100%",aspectRatio:"16/10",background:t.surfaceSunken,display:"flex",alignItems:"center",justifyContent:"center",borderBottom:`1px solid ${t.border}`}}>
        {build.photoUrl?(
          <button onClick={()=>openLightbox(build.photoUrl)} aria-label="View photo full-screen" className="bl-focusable"
            style={{width:"100%",height:"100%",border:"none",padding:0,background:"none",cursor:"pointer"}}>
            <img src={build.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          </button>
        ):(
          <Monitor size={40} strokeWidth={1.5} color={t.textFaint}/>
        )}
      </div>

      <div style={{padding:"18px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:14}}>
          <div style={{color:t.text,fontWeight:700,fontSize:19,fontFamily:FONT_DISPLAY}}>{build.name}</div>
          <span style={{fontSize:10.5,fontWeight:700,color:t.info,letterSpacing:"0.03em"}}>Active build</span>
        </div>

        <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:t.textMuted,marginBottom:10}}>Cost breakdown</div>
          {[["Total cost",fmt(cost),t.text],["Market value",fmt(market),t.text],
            ["Potential profit",`${potential>=0?"+":""}${fmt(potential)}`,potential>=0?t.positive:t.negative]
          ].map(([l,v,c],i)=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:i<2?7:0,paddingTop:i===2?8:0,borderTop:i===2?`1px solid ${t.border}`:"none"}}>
              <span style={{color:t.textMuted}}>{l}</span>
              <span style={{fontFamily:FONT_MONO,fontWeight:i===2?700:600,color:c}}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
          <Btn variant="primary" icon={Pencil} onClick={onEdit} style={{width:"100%"}}>Edit parts — add or remove</Btn>
          <Btn variant="ghost" icon={Receipt} onClick={()=>setShowReceiptPrompt(true)} style={{width:"100%"}}>Make a receipt</Btn>
          <Btn variant="ghost" icon={Undo2} onClick={onDissolve} style={{width:"100%"}}>Dissolve build — return parts to inventory</Btn>
          <Btn variant="ghost" icon={ClipboardList} onClick={onCopySpecs} style={{width:"100%"}}>Copy specs for listing</Btn>
          <div style={{paddingTop:6,borderTop:`1px solid ${t.border}`,marginTop:6}}>
            <Btn variant="danger" icon={Trash2} onClick={onDelete} style={{width:"100%"}}>Delete build</Btn>
          </div>
        </div>

        <div style={{marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:t.textMuted,marginBottom:10}}>Components ({parts.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {parts.map(p=>(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:9}}>
                <PhotoThumb url={p.photoUrl} size={32} seed={p.id.length} onClick={p.photoUrl?()=>openLightbox(p.photoUrl):undefined} label={`View photo of ${p.name}`}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:t.text,fontSize:13}}>{p.name}</div>
                  <div style={{color:t.textFaint,fontSize:10}}>{p.category}</div>
                </div>
                <span style={{fontFamily:FONT_MONO,fontSize:12,color:t.textMuted}}>{fmt(p.allocatedCost)}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
          <DetailRow label="Created" value={build.date}/>
        </div>

      </div>
      {showReceiptPrompt&&(
        <ReceiptPricePromptModal buildName={build.name} onCancel={()=>setShowReceiptPrompt(false)} onConfirm={generateBuildReceipt}/>
      )}
      {buildReceipt&&(
        <ReceiptModal title={build.name} date={today()} total={buildReceipt.total}
          receiptRows={buildReceipt.rows} onClose={()=>setBuildReceipt(null)}/>
      )}
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   BUILDS
═══════════════════════════════════════════ */
