

import { Wrench, Trash2, Pencil, AlertTriangle, Zap, ClipboardCopy } from "lucide-react";
import { fmt } from "../data/model.js";
import { FONT_DISPLAY, FONT_MONO, useTheme } from "./theme.js";
import { StatusBadge } from "./StatusBadge.jsx";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { DetailRow } from "./DetailRow.jsx";

export function PartDetailSheet({part,buildName,onClose,openLightbox,onQuickSell,onEdit,onDefective,onDelete,onDuplicate,onAddToBuild,onGoToBuild}) {
  const t=useTheme();
  const potential=part.marketValue-part.allocatedCost;
  return (
    <ModalShell onClose={onClose} label={part.name} sheet maxWidth={520} padding={0}>
      <div style={{width:"100%",aspectRatio:"16/10",background:t.surfaceSunken,display:"flex",alignItems:"center",justifyContent:"center",
        borderBottom:`1px solid ${t.border}`}}>
        {part.photoUrl?(
          <button onClick={()=>openLightbox(part.photoUrl)} aria-label="View photo full-screen" className="bl-focusable"
            style={{width:"100%",height:"100%",border:"none",padding:0,background:"none",cursor:"pointer"}}>
            <img src={part.photoUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
          </button>
        ):(
          <Wrench size={40} strokeWidth={1.5} color={t.textFaint}/>
        )}
      </div>

      <div style={{padding:"18px 20px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:14}}>
          <div style={{color:t.text,fontWeight:700,fontSize:19,fontFamily:FONT_DISPLAY}}>{part.name}</div>
          <StatusBadge s={part.status}/>
        </div>

        <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:11,padding:14,marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:600,color:t.textMuted,marginBottom:10}}>Purchase details</div>
          {[["Bought",fmt(part.allocatedCost),t.text],["Market value",fmt(part.marketValue),t.text],
            ["Potential profit",`${potential>=0?"+":""}${fmt(potential)}`,potential>=0?t.positive:t.negative]
          ].map(([l,v,c],i)=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:i<2?7:0,paddingTop:i===2?8:0,borderTop:i===2?`1px solid ${t.border}`:"none"}}>
              <span style={{color:t.textMuted}}>{l}</span>
              <span style={{fontFamily:FONT_MONO,fontWeight:i===2?700:600,color:c}}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:16}}>
          <DetailRow label="Category" value={part.category}/>
          <DetailRow label="Purchase source" value={part.source}/>
          {part.history?.[0]?.date&&<DetailRow label="Purchase date" value={part.history[0].date}/>}
          {buildName&&<DetailRow label="Status" value={`Used in ${buildName}`} valueColor={t.info}/>}
          {part.soldTo&&<DetailRow label="Sold to" value={part.soldTo}/>}
          {part.notes&&<DetailRow label="Notes" value={part.notes}/>}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {part.status==="available"&&(
            <div style={{display:"flex",gap:8}}>
              <Btn variant="success" icon={Zap} onClick={onQuickSell} style={{flex:1}}>Quick sell</Btn>
              <Btn variant="ghost" icon={Wrench} onClick={onAddToBuild} style={{flex:1}}>Add to build</Btn>
            </div>
          )}
          <div style={{display:"flex",gap:8}}>
            <Btn variant="ghost" icon={Pencil} onClick={onEdit} style={{flex:1}}>Edit</Btn>
            <Btn variant="ghost" icon={ClipboardCopy} onClick={onDuplicate} style={{flex:1}}>Duplicate</Btn>
          </div>
          {part.status==="in_build"?(
            <div style={{marginTop:6,paddingTop:14,borderTop:`1px solid ${t.border}`}}>
              <div style={{fontSize:12,color:t.textMuted,lineHeight:1.5,marginBottom:8}}>
                This part is used in <strong style={{color:t.info}}>{buildName}</strong>. Dissolve that build first to free it up before editing its defective/delete status here.
              </div>
              <Btn variant="ghost" icon={Wrench} onClick={onGoToBuild} style={{width:"100%"}}>Go to {buildName}</Btn>
            </div>
          ):(
            <div style={{display:"flex",gap:8,marginTop:6,paddingTop:14,borderTop:`1px solid ${t.border}`}}>
              {part.status!=="sold"&&part.status!=="defective"&&(
                <Btn variant="warn" icon={AlertTriangle} onClick={onDefective} style={{flex:1}}>Mark defective</Btn>
              )}
              <Btn variant="danger" icon={Trash2} onClick={onDelete} style={{flex:1}}>Delete</Btn>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

