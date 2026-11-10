import { useState } from "react";

import { Wrench, ChevronUp, Trash2, Pencil, Receipt, Link as LinkIcon, Undo2, Monitor } from "lucide-react";
import { fmt, pct } from "../data/model.js";
import { FONT_DISPLAY, FONT_MONO, useTheme } from "./theme.js";
import { PhotoThumb } from "./PhotoThumb.jsx";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { DetailRow } from "./DetailRow.jsx";
import { STATUS_COLOR_KEY } from "./STATUS_COLOR_KEY.jsx";
import { ReceiptModal } from "./ReceiptModal.jsx";

export function TransactionDetailSheet({sale,state,openLightbox,onClose,onEdit,onUndo,onDelete}) {
  const t=useTheme();
  const [showBreakdown,setShowBreakdown]=useState(false);
  const [showReceipt,setShowReceipt]=useState(false);
  const status=sale.deleted?"deleted":sale.returned?"returned":"completed";
  const statusColor=t[STATUS_COLOR_KEY[status]]||t.textMuted;
  const linkedPart=state.parts.find(p=>p.id===sale.partId);
  const linkedBuild=state.builds.find(b=>b.id===sale.buildId);
  const buildParts=sale.buildPartsSnapshot?.length
    ?sale.buildPartsSnapshot
    :(linkedBuild?state.parts.filter(p=>linkedBuild.partIds.includes(p.id)):[]);
  const totalPartsCost=buildParts.reduce((s,p)=>s+p.allocatedCost,0);
  const breakdownRows=buildParts.map(p=>{
    const costShare=totalPartsCost>0?p.allocatedCost/totalPartsCost:(buildParts.length?1/buildParts.length:0);
    return {
      ...p,
      costSharePct:costShare,
      allocatedSale:costShare*sale.salePrice,
      allocatedProfit:costShare*sale.profit,
    };
  });

  const totalMarketValue=buildParts.reduce((s,p)=>s+(p.marketValue||0),0);
  const receiptRows=buildParts.map(p=>{
    const marketShare=totalMarketValue>0?(p.marketValue||0)/totalMarketValue:(buildParts.length?1/buildParts.length:0);
    return {...p,scaledPrice:marketShare*sale.salePrice};
  });
  const img=sale.proofPhotoUrl||linkedPart?.photoUrl||linkedBuild?.photoUrl;
  return (
    <ModalShell onClose={onClose} label={sale.name} sheet maxWidth={520} padding={0}>
      <div style={{width:"100%",aspectRatio:"16/10",background:t.surfaceSunken,display:"flex",alignItems:"center",justifyContent:"center",borderBottom:`1px solid ${t.border}`}}>
        {img?(
          <button onClick={()=>openLightbox(img)} aria-label="View photo full-screen" className="bl-focusable"
            style={{width:"100%",height:"100%",border:"none",padding:0,background:"none",cursor:"pointer"}}>
            <img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          </button>
        ):(sale.buildId?<Monitor size={40} strokeWidth={1.5} color={t.textFaint}/>:<Wrench size={40} strokeWidth={1.5} color={t.textFaint}/>)}
      </div>
      <div style={{padding:"18px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:14}}>
          <div style={{color:t.text,fontWeight:700,fontSize:19,fontFamily:FONT_DISPLAY}}>{sale.name}</div>
          <span style={{fontSize:10.5,fontWeight:700,color:statusColor,letterSpacing:"0.04em"}}>{status.toUpperCase()}</span>
        </div>

        <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:t.textMuted,marginBottom:10}}>Transaction</div>
          {[["Cost price",fmt(sale.cost),t.text],["Sale price",fmt(sale.salePrice),t.text],
            ["Profit / loss",`${sale.profit>=0?"+":""}${fmt(sale.profit)}`,sale.profit>=0?t.positive:t.negative]
          ].map(([l,v,c],i)=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:i<2?7:0,paddingTop:i===2?8:0,borderTop:i===2?`1px solid ${t.border}`:"none"}}>
              <span style={{color:t.textMuted}}>{l}</span>
              <span style={{fontFamily:FONT_MONO,fontWeight:i===2?700:600,color:c}}>{v}</span>
            </div>
          ))}
        </div>

        {(sale.buildId||sale.buildPartsSnapshot?.length>0)&&(
          <div style={{marginBottom:14}}>
            <Btn variant="ghost" icon={showBreakdown?ChevronUp:Wrench} onClick={()=>setShowBreakdown(v=>!v)} style={{width:"100%"}}>
              {showBreakdown?"Hide parts":`View parts${buildParts.length?` (${buildParts.length})`:""}`}
            </Btn>

            {showBreakdown&&(buildParts.length===0?(
              <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14,marginTop:8,color:t.textMuted,fontSize:12}}>
                This build's individual parts are no longer available to look up (the build record was deleted after this sale) — only the total cost, sale price, and profit above are still known.
              </div>
            ):(
              <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14,marginTop:8,animation:"blFadeUp 0.18s ease"}}>
                <div style={{fontSize:10.5,color:t.textFaint,marginBottom:12,lineHeight:1.45}}>
                  Sale price and profit are attributed to each part in proportion to its share of what the build cost to assemble.
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:13}}>
                  {breakdownRows.map(p=>(
                    <div key={p.id}>
                      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:6}}>
                        <PhotoThumb url={p.photoUrl} size={30} seed={p.id.length}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{color:t.text,fontSize:12.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                          <div style={{color:t.textFaint,fontSize:10}}>{p.category}</div>
                        </div>
                        <span style={{fontFamily:FONT_MONO,fontSize:12.5,color:t.textMuted,flexShrink:0}}>{fmt(p.allocatedCost)}</span>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,paddingLeft:39}}>
                        <div>
                          <div style={{fontSize:9,color:t.textFaint}}>% of cost</div>
                          <div style={{fontSize:12,fontFamily:FONT_MONO,color:t.accent,fontWeight:600}}>{pct(p.costSharePct)}</div>
                        </div>
                        <div>
                          <div style={{fontSize:9,color:t.textFaint}}>Alloc. sale</div>
                          <div style={{fontSize:12,fontFamily:FONT_MONO,color:t.textMuted,fontWeight:600}}>{fmt(p.allocatedSale)}</div>
                        </div>
                        <div>
                          <div style={{fontSize:9,color:t.textFaint}}>Alloc. profit</div>
                          <div style={{fontSize:12,fontFamily:FONT_MONO,color:p.allocatedProfit>=0?t.positive:t.negative,fontWeight:600}}>
                            {p.allocatedProfit>=0?"+":""}{fmt(p.allocatedProfit)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginTop:12,paddingTop:10,borderTop:`1px solid ${t.border}`}}>
                  <div>
                    <div style={{fontSize:9,color:t.textMuted}}>Total cost</div>
                    <div style={{fontSize:12.5,fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(totalPartsCost)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:t.textMuted}}>Total sale</div>
                    <div style={{fontSize:12.5,fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(sale.salePrice)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:t.textMuted}}>Total profit</div>
                    <div style={{fontSize:12.5,fontFamily:FONT_MONO,fontWeight:700,color:sale.profit>=0?t.positive:t.negative}}>
                      {sale.profit>=0?"+":""}{fmt(sale.profit)}
                    </div>
                  </div>
                </div>
                <div style={{marginTop:14,paddingTop:12,borderTop:`1px solid ${t.border}`}}>
                  <Btn variant="primary" icon={Receipt} onClick={()=>setShowReceipt(true)} style={{width:"100%"}}>Generate receipt</Btn>
                  <div style={{fontSize:9.5,color:t.textFaint,marginTop:6,textAlign:"center"}}>Customer-facing invoice — no cost or profit info included</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
          <DetailRow label="Buyer" value={sale.buyerName||"—"}/>
          <DetailRow label="Sale date" value={sale.date}/>
          {sale.convoLink&&(
            <div>
              <div style={{fontSize:11,color:t.textFaint,marginBottom:2}}>Conversation</div>
              <a href={sale.convoLink} target="_blank" rel="noopener noreferrer" style={{color:t.info,fontSize:13,display:"inline-flex",alignItems:"center",gap:5}}>
                <LinkIcon size={12}/>Open conversation link
              </a>
            </div>
          )}
          {sale.notes&&<DetailRow label="Notes" value={sale.notes}/>}
          {sale.edited&&<DetailRow label="Last edited" value={sale.editedAt} valueColor={t.textFaint}/>}
          {sale.returned&&<DetailRow label="Return reason" value={sale.returnReason||"—"} valueColor={t.warning}/>}
        </div>

        {!sale.deleted&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Btn variant="ghost" icon={Pencil} onClick={onEdit}>Edit transaction</Btn>
            {!sale.returned&&<Btn variant="warn" icon={Undo2} onClick={onUndo}>Undo sale</Btn>}
            <div style={{paddingTop:6,borderTop:`1px solid ${t.border}`,marginTop:6}}>
              <Btn variant="danger" icon={Trash2} onClick={onDelete} style={{width:"100%"}}>Delete transaction</Btn>
            </div>
          </div>
        )}
      </div>
      {showReceipt&&<ReceiptModal title={sale.name} subtitle={sale.buyerName?`For ${sale.buyerName}`:undefined} date={sale.date} total={sale.salePrice} receiptRows={receiptRows} onClose={()=>setShowReceipt(false)}/>}
    </ModalShell>
  );
}

/* ═══════════════════════════════════════════
   RECEIPT MODAL — customer-facing invoice. Deliberately shows ONLY item names and
   scaled prices that sum to what the customer actually paid.
═══════════════════════════════════════════ */
