import { useState } from "react";

import { Search, Receipt, Monitor } from "lucide-react";
import { fmt, uid } from "../data/model.js";
import { FONT_BODY, FONT_MONO, useTheme } from "./theme.js";
import { StatusBadge } from "./StatusBadge.jsx";
import { PhotoThumb } from "./PhotoThumb.jsx";
import { ModalShell } from "./ModalShell.jsx";
import { Inventory } from "../pages/Inventory.jsx";
import { Builds } from "../pages/Builds.jsx";
import { History } from "../pages/History.jsx";

export function GlobalSearchModal({state,onClose,onJump}) {
  const t=useTheme();
  const [q,setQ]=useState("");
  const query=q.trim().toLowerCase();

  const partResults=query?state.parts.filter(p=>p.name.toLowerCase().includes(query)||p.category.toLowerCase().includes(query)).slice(0,6):[];
  const buildResults=query?state.builds.filter(b=>!b.dissolved&&b.name.toLowerCase().includes(query)).slice(0,5):[];
  const saleResults=query?state.sales.filter(s=>!s.deleted&&(s.name.toLowerCase().includes(query)||(s.buyerName||"").toLowerCase().includes(query))).slice(0,5):[];
  const noResults=query&&partResults.length===0&&buildResults.length===0&&saleResults.length===0;

  const goInventory=()=>onJump("Inventory",{query:q,nonce:uid()});
  const goHistory=()=>onJump("History",{query:q,nonce:uid()});
  const goBuilds=()=>onJump("Builds",null);

  return (
    <ModalShell onClose={onClose} label="Search" maxWidth={480} padding={0}>
      <div style={{padding:"16px 18px",borderBottom:`1px solid ${t.border}`}}>
        <div style={{position:"relative"}}>
          <Search size={16} color={t.textFaint} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}} aria-hidden="true"/>
          <input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search parts, builds, sales…"
            aria-label="Search everything"
            style={{width:"100%",boxSizing:"border-box",background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,
              padding:"11px 12px 11px 36px",color:t.text,fontSize:16,outline:"none",fontFamily:FONT_BODY}}/>
        </div>
      </div>
      <div style={{maxHeight:400,overflowY:"auto",padding:query?"8px 8px 14px":"20px 18px"}}>
        {!query&&<div style={{color:t.textFaint,fontSize:12.5,textAlign:"center",padding:"10px 0"}}>Start typing to search across everything at once.</div>}

        {partResults.length>0&&(
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10.5,fontWeight:700,color:t.textFaint,padding:"8px 10px 4px",letterSpacing:"0.03em"}}>PARTS</div>
            {partResults.map(p=>(
              <button key={p.id} onClick={goInventory} className="bl-focusable" style={{width:"100%",display:"flex",alignItems:"center",gap:10,
                padding:"9px 10px",borderRadius:8,border:"none",background:"transparent",cursor:"pointer",textAlign:"left",fontFamily:FONT_BODY,minHeight:44}}
                onMouseEnter={e=>e.currentTarget.style.background=t.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <PhotoThumb url={p.photoUrl} size={30} seed={p.id.length}/>
                <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:t.text,fontSize:13}}>{p.name}</span>
                <StatusBadge s={p.status}/>
              </button>
            ))}
          </div>
        )}

        {buildResults.length>0&&(
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10.5,fontWeight:700,color:t.textFaint,padding:"8px 10px 4px",letterSpacing:"0.03em"}}>BUILDS</div>
            {buildResults.map(b=>(
              <button key={b.id} onClick={goBuilds} className="bl-focusable" style={{width:"100%",display:"flex",alignItems:"center",gap:10,
                padding:"9px 10px",borderRadius:8,border:"none",background:"transparent",cursor:"pointer",textAlign:"left",fontFamily:FONT_BODY,minHeight:44}}
                onMouseEnter={e=>e.currentTarget.style.background=t.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <PhotoThumb url={b.photoUrl} size={30} seed={b.id.length}/>
                <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:t.text,fontSize:13}}>{b.name}</span>
                <Monitor size={14} color={t.textFaint}/>
              </button>
            ))}
          </div>
        )}

        {saleResults.length>0&&(
          <div>
            <div style={{fontSize:10.5,fontWeight:700,color:t.textFaint,padding:"8px 10px 4px",letterSpacing:"0.03em"}}>SALES</div>
            {saleResults.map(s=>(
              <button key={s.id} onClick={goHistory} className="bl-focusable" style={{width:"100%",display:"flex",alignItems:"center",gap:10,
                padding:"9px 10px",borderRadius:8,border:"none",background:"transparent",cursor:"pointer",textAlign:"left",fontFamily:FONT_BODY,minHeight:44}}
                onMouseEnter={e=>e.currentTarget.style.background=t.surfaceHover} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                <Receipt size={16} color={t.textFaint} style={{flexShrink:0}}/>
                <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:t.text,fontSize:13}}>{s.name}{s.buyerName?` · ${s.buyerName}`:""}</span>
                <span style={{fontFamily:FONT_MONO,fontSize:12,color:s.profit>=0?t.positive:t.negative}}>{fmt(s.salePrice)}</span>
              </button>
            ))}
          </div>
        )}

        {noResults&&<div style={{color:t.textFaint,fontSize:13,textAlign:"center",padding:"24px 0"}}>Nothing matches "{q}".</div>}
      </div>
    </ModalShell>
  );
}

