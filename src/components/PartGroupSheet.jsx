

import { ChevronRight } from "lucide-react";
import { fmt } from "../data/model.js";
import { FONT_DISPLAY, FONT_BODY, FONT_MONO, useTheme } from "./theme.js";
import { StatusBadge } from "./StatusBadge.jsx";
import { PhotoThumb } from "./PhotoThumb.jsx";
import { ModalShell } from "./ModalShell.jsx";

export function PartGroupSheet({group,onClose,onViewUnit}) {
  const t=useTheme();
  const p=group[0];
  const count=group.length;
  const totalCost=p.allocatedCost*count;
  const totalMarket=p.marketValue*count;
  return (
    <ModalShell onClose={onClose} label={`${p.name} — ${count} units`} sheet maxWidth={520} padding={0}>
      <div style={{padding:"6px 20px 20px"}}>
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:16}}>
          <PhotoThumb url={p.photoUrl} size={52} seed={p.id.length}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:t.text,fontWeight:700,fontSize:16,fontFamily:FONT_DISPLAY}}>{p.name}</div>
            <div style={{color:t.textMuted,fontSize:12,marginTop:2}}>{p.category} · {count} identical units</div>
          </div>
          <StatusBadge s={p.status}/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
          <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:11}}>
            <div style={{fontSize:10.5,color:t.textMuted,fontWeight:600}}>Cost each</div>
            <div style={{fontSize:14,fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(p.allocatedCost)}</div>
            <div style={{fontSize:10.5,color:t.textFaint,marginTop:2}}>Total {fmt(totalCost)}</div>
          </div>
          <div style={{background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:11}}>
            <div style={{fontSize:10.5,color:t.textMuted,fontWeight:600}}>Market each</div>
            <div style={{fontSize:14,fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt(p.marketValue)}</div>
            <div style={{fontSize:10.5,color:t.textFaint,marginTop:2}}>Total {fmt(totalMarket)}</div>
          </div>
        </div>

        <div style={{fontSize:12,color:t.textMuted,fontWeight:600,marginBottom:10}}>
          Individual units — select one to sell, edit, or mark it defective
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {group.map((unit,i)=>(
            <button key={unit.id} onClick={()=>onViewUnit(unit)} className="bl-focusable" style={{display:"flex",alignItems:"center",gap:10,padding:"10px 11px",
              borderRadius:9,background:t.surfaceSunken,border:`1px solid ${t.border}`,cursor:"pointer",transition:"border-color 0.15s",width:"100%",textAlign:"left",fontFamily:FONT_BODY}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=t.borderStrong;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;}}>
              <span style={{color:t.textFaint,fontSize:11,fontFamily:FONT_MONO,width:20,flexShrink:0}}>{i+1}</span>
              <PhotoThumb url={unit.photoUrl} size={28} seed={unit.id.length}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:t.text,fontSize:12.5,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                  {unit.notes?unit.notes:`Unit ${i+1}`}
                </div>
              </div>
              <ChevronRight size={16} color={t.textFaint}/>
            </button>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
