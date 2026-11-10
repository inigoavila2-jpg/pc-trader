import { useState } from "react";

import { Wrench, Banknote, Search, Check, Wallet, Zap, Monitor } from "lucide-react";
import { fmt, today, uid } from "../data/model.js";
import { FONT_DISPLAY, FONT_BODY, FONT_MONO, useTheme } from "./theme.js";
import { usePersistentState } from "../hooks/appHooks.js";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { Inp } from "./Inp.jsx";
import { Segmented } from "./Segmented.jsx";

export function QuickSellPickerModal({state,dispatch,toast,onClose}) {
  const t=useTheme();
  const [search,setSearch]=useState("");
  const [selId,setSelId]=useState("");
  const [salePrice,setSalePrice]=useState("");
  const [buyer,setBuyer]=useState("");
  const [paymentAccount,setPaymentAccount]=usePersistentState("pctrader:lastSaleAccount","bank");

  const avail=state.parts.filter(p=>p.status==="available");
  const builds=state.builds.filter(b=>!b.dissolved&&!b.sold);
  const items=[
    ...avail.map(p=>({id:p.id,name:p.name,cost:p.allocatedCost,mode:"part"})),
    ...builds.map(b=>({id:b.id,name:b.name,cost:state.parts.filter(p=>b.partIds.includes(p.id)).reduce((s,p)=>s+p.allocatedCost,0),mode:"build"})),
  ].filter(it=>!search||it.name.toLowerCase().includes(search.toLowerCase()));

  const selected=items.find(it=>it.id===selId);
  const sp=parseFloat(salePrice)||0;
  const profit=selected?sp-selected.cost:0;

  const submit=()=>{
    if(!selected||!salePrice){toast("Pick an item and enter a price","error");return;}
    const buildPartsSnapshot=selected.mode==="build"
      ?state.parts.filter(p=>builds.find(b=>b.id===selected.id)?.partIds.includes(p.id)).map(p=>({id:p.id,name:p.name,category:p.category,allocatedCost:p.allocatedCost,marketValue:p.marketValue,photoUrl:p.photoUrl}))
      :undefined;
    dispatch({type:"SELL",mode:selected.mode,id:selected.id,sale:{id:uid(),
      partId:selected.mode==="part"?selected.id:null,buildId:selected.mode==="build"?selected.id:null,
      name:selected.name,cost:selected.cost,salePrice:sp,profit,buyerName:buyer,date:today(),paymentAccount,buildPartsSnapshot}});
    toast(`${selected.name} sold for ${fmt(sp)} — profit ${fmt(profit)}`,profit>=0?"success":"warn");
    onClose();
  };

  return (
    <ModalShell onClose={onClose} label="Quick sell">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:4,fontFamily:FONT_DISPLAY,display:"flex",alignItems:"center",gap:8}}><Zap size={17} color={t.accent}/>Quick sell</div>
      <div style={{fontSize:12,color:t.textFaint,marginBottom:16}}>Find it, price it, done.</div>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        {!selected?(
          <>
            <Inp value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search parts and builds…" icon={Search} aria-label="Search parts and builds"/>
            <div style={{display:"flex",flexDirection:"column",gap:5,maxHeight:240,overflowY:"auto"}}>
              {items.length===0?(
                <div style={{color:t.textFaint,fontSize:13,padding:"10px 0"}}>Nothing available to sell.</div>
              ):items.map(it=>(
                <button key={it.id} onClick={()=>setSelId(it.id)} className="bl-focusable" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,
                  width:"100%",background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",textAlign:"left",minHeight:44,fontFamily:FONT_BODY}}>
                  <span style={{color:t.text,fontSize:13,display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                    {it.mode==="build"?<Monitor size={14} color={t.textFaint} style={{flexShrink:0}}/>:<Wrench size={14} color={t.textFaint} style={{flexShrink:0}}/>}
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.name}</span>
                  </span>
                  <span style={{fontFamily:FONT_MONO,fontSize:12,color:t.textMuted,flexShrink:0}}>{fmt(it.cost)}</span>
                </button>
              ))}
            </div>
          </>
        ):(
          <>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:8,padding:"10px 12px"}}>
              <span style={{color:t.text,fontSize:13,display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                {selected.mode==="build"?<Monitor size={14} color={t.textFaint}/>:<Wrench size={14} color={t.textFaint}/>}
                <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{selected.name}</span>
              </span>
              <Btn small variant="ghost" onClick={()=>setSelId("")}>Change</Btn>
            </div>
            <Inp label="Sale price (₱)" type="number" value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="5000"/>
            <div><div style={{fontSize:12.5,color:t.textMuted,fontWeight:500,marginBottom:6}}>Receive payment into</div><Segmented ariaLabel="Receive payment into" value={paymentAccount} onChange={setPaymentAccount} options={[["bank","Business Bank",Wallet],["cash","Cash",Banknote]]}/></div>
            <Inp label="Buyer name (optional)" value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="Juan dela Cruz"/>
            {sp>0&&(
              <div style={{fontSize:12,color:profit>=0?t.positive:t.negative,fontWeight:600}}>
                {profit>=0?"+":""}{fmt(profit)} profit
              </div>
            )}
          </>
        )}
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn variant="success" icon={Check} onClick={submit} disabled={!selected||!salePrice} style={{flex:1}}>Record sale</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

