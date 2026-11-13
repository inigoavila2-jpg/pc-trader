import { useState } from "react";

import { Banknote, Check, ChevronDown, Wallet, Link as LinkIcon, Monitor, Cpu, Search } from "lucide-react";
import { fmt, pct, today, uid } from "../data/model.js";
import { FONT_BODY, FONT_MONO, useTheme, PhotoUpload, PhotoThumb, Card, Btn, Inp, PageHeader, Segmented } from "../components/index.js";
import { usePersistentState } from "../hooks/appHooks.js";

export function Sell({state,dispatch,toast,openLightbox}) {
  const t=useTheme();
  const [mode,setMode]=useState("part");
  const [selId,setSelId]=useState("");
  const [salePrice,setSalePrice]=useState("");
  const [buyer,setBuyer]=useState("");
  const [paymentAccount,setPaymentAccount]=usePersistentState("pctrader:lastSaleAccount","bank");
  const [convoLink,setConvoLink]=useState("");
  const [proofPhoto,setProofPhoto]=useState({photoUrl:"",photoRecordId:""});
  const [loading,setLoading]=useState(false);
  const [attempted,setAttempted]=useState(false);
  const [pickerOpen,setPickerOpen]=useState(false);
  const [pickerSearch,setPickerSearch]=useState("");
  const targetMargin=state.settings?.targetMargin||30;

  const avail=state.parts.filter(p=>p.status==="available");
  const builds=state.builds.filter(b=>!b.dissolved&&!b.sold);
  const tp=avail.find(p=>p.id===selId);
  const tb=builds.find(b=>b.id===selId);
  const cost=mode==="part"?tp?.allocatedCost||0:tb?state.parts.filter(p=>tb.partIds.includes(p.id)).reduce((s,p)=>s+p.allocatedCost,0):0;
  const marketVal=mode==="part"?tp?.marketValue||0:tb?state.parts.filter(p=>tb.partIds.includes(p.id)).reduce((s,p)=>s+p.marketValue,0):0;
  const suggestedCostPlus=cost>0?Math.round(cost*(1+targetMargin/100)):0;
  const sp=parseFloat(salePrice)||0;
  const profit=sp-cost;
  const margin=cost>0?profit/cost:0;
  const selectedPhoto=mode==="part"?tp?.photoUrl:tb?.photoUrl;
  const selectedLabel=mode==="part"?tp?.name:tb?.name;

  const submit=()=>{
    setAttempted(true);
    if(!selId||!(sp>0)){toast("Select an item and enter a sale price above zero","error");return;}
    setLoading(true);
    const name=mode==="part"?tp?.name:tb?.name;
    const buildPartsSnapshot=mode==="build"&&tb
      ?state.parts.filter(p=>tb.partIds.includes(p.id)).map(p=>({id:p.id,name:p.name,category:p.category,allocatedCost:p.allocatedCost,marketValue:p.marketValue,photoUrl:p.photoUrl}))
      :undefined;
    setTimeout(()=>{
      dispatch({type:"SELL",mode,id:selId,sale:{id:uid(),partId:mode==="part"?selId:null,buildId:mode==="build"?selId:null,name,cost,salePrice:sp,profit,buyerName:buyer,date:today(),paymentAccount,
        buildPartsSnapshot,
        convoLink:convoLink.trim(),proofPhotoUrl:proofPhoto.photoUrl,proofPhotoRecordId:proofPhoto.photoRecordId}});
      toast(`${name} sold for ${fmt(sp)} — profit ${fmt(profit)}`,profit>=0?"success":"warn");
      setSelId("");setSalePrice("");setBuyer("");setConvoLink("");setProofPhoto({photoUrl:"",photoRecordId:""});setLoading(false);setAttempted(false);
    },400);
  };

  // Fewer clicks: the moment an item is picked, pre-fill the price with the cost-plus-margin
  // suggestion (the one most sales actually use) and focus it, already selected, so typing a
  // different number just overwrites — accepting the default is now zero extra clicks.
  const pickItem=(id)=>{
    setSelId(id);
    setPickerOpen(false);
    const part=avail.find(p=>p.id===id);
    const build=builds.find(b=>b.id===id);
    const itemCost=mode==="part"?part?.allocatedCost||0:build?state.parts.filter(p=>build.partIds.includes(p.id)).reduce((s,p)=>s+p.allocatedCost,0):0;
    if(itemCost>0)setSalePrice(String(Math.round(itemCost*(1+targetMargin/100))));
    requestAnimationFrame(()=>{
      const el=document.querySelector('[data-sell-price-input="1"]');
      el?.focus();el?.select?.();
    });
  };

  const list=(mode==="part"?avail:builds).filter(item=>item.name.toLowerCase().includes(pickerSearch.trim().toLowerCase()));

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      <PageHeader title="Sell" sub="Record a sale and lock in your profit."/>
      <Segmented ariaLabel="What are you selling" value={mode} onChange={m=>{setMode(m);setSelId("");setPickerSearch("");setPickerOpen(false);setAttempted(false);}}
        options={[["part","Sell part",Cpu],["build","Sell build",Monitor]]}/>
      <Card>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Photo-enabled picker — a native <select> can't render images, so this is a custom
              disclosure. Options are real, independently focusable <button>s (fully Tab/Enter
              reachable); Escape on the panel closes it and returns focus to the trigger. */}
          <div style={{position:"relative"}} onKeyDown={e=>{if(e.key==="Escape"){setPickerOpen(false);}}}>
            <div style={{fontSize:12.5,color:t.textMuted,fontWeight:500,marginBottom:6}}>{mode==="part"?"Select part":"Select build"}</div>
            <button type="button" onClick={()=>setPickerOpen(o=>!o)} aria-haspopup="listbox" aria-expanded={pickerOpen} className="bl-focusable"
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,minHeight:44,
              background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:"9px 12px",cursor:"pointer",textAlign:"left"}}>
              {selId?(
                <>
                  <PhotoThumb url={selectedPhoto} size={34} seed={selId.length}/>
                  <span style={{color:t.text,fontSize:13,flex:1}}>{selectedLabel}</span>
                  <span style={{fontFamily:FONT_MONO,fontSize:12,color:t.textMuted}}>{mode==="part"?fmt(tp?.allocatedCost||0):""}</span>
                </>
              ):<span style={{color:t.textFaint,fontSize:13,flex:1}}>— choose —</span>}
              <ChevronDown size={15} color={t.textMuted} style={{transform:pickerOpen?"rotate(180deg)":"none",transition:"transform 0.15s",flexShrink:0}}/>
            </button>
            {attempted&&!selId&&<div role="alert" style={{fontSize:12,color:t.negative,marginTop:5}}>Choose an item to sell.</div>}
            {pickerOpen&&(
              <>
                <div onClick={()=>setPickerOpen(false)} aria-hidden="true" style={{position:"fixed",inset:0,zIndex:40}}/>
                <div style={{position:"absolute",top:"100%",left:0,right:0,marginTop:6,background:t.bgElevated,
                  border:`1px solid ${t.border}`,borderRadius:9,overflow:"hidden",maxHeight:340,display:"flex",flexDirection:"column",
                  animation:"blFadeUp 0.15s ease",boxShadow:t.shadow,zIndex:50}}>
                  <div style={{padding:8,borderBottom:`1px solid ${t.border}`}}>
                    <Inp value={pickerSearch} onChange={e=>setPickerSearch(e.target.value)} placeholder={`Search ${mode==="part"?"parts":"builds"}…`} icon={Search} aria-label={`Search ${mode==="part"?"parts":"builds"} to sell`}/>
                  </div>
                  <div role="listbox" aria-label={mode==="part"?"Available parts":"Available builds"} style={{overflowY:"auto"}}>
                  {list.length===0?(
                    <div style={{padding:14,color:t.textFaint,fontSize:13}}>{pickerSearch?"No matching items.":"Nothing available to sell."}</div>
                  ):list.map(item=>(
                    <button key={item.id} type="button" role="option" aria-selected={selId===item.id} onClick={()=>pickItem(item.id)}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:10,background:selId===item.id?t.accentSoft:"transparent",
                        border:"none",borderBottom:`1px solid ${t.border}`,padding:"9px 12px",cursor:"pointer",textAlign:"left",fontFamily:FONT_BODY,minHeight:44}}
                      onMouseEnter={e=>e.currentTarget.style.background=t.surfaceHover}
                      onMouseLeave={e=>e.currentTarget.style.background=selId===item.id?t.accentSoft:"transparent"}>
                      <PhotoThumb url={item.photoUrl} size={34} seed={item.id.length}/>
                      <span style={{color:t.text,fontSize:13,flex:1}}>{item.name}</span>
                      <span style={{fontFamily:FONT_MONO,fontSize:12,color:t.textMuted}}>{mode==="part"?fmt(item.allocatedCost):""}</span>
                    </button>
                  ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Price suggestion — two options, since anchoring only to cost-plus-margin undersells
              when the item's real market value is much higher than what it cost to acquire. */}
          {selId&&(cost>0||marketVal>0)&&(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {cost>0&&(
                <div style={{background:t.accentSoft,border:`1px solid ${t.accentSoftBorder}`,borderRadius:9,padding:"9px 12px",fontSize:12,color:t.accent,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                  <span>Cost + {targetMargin}% margin</span>
                  <Btn small onClick={()=>setSalePrice(String(suggestedCostPlus))}>Use {fmt(suggestedCostPlus)}</Btn>
                </div>
              )}
              {marketVal>0&&(
                <div style={{background:t.infoSoft,border:`1px solid ${t.infoSoftBorder}`,borderRadius:9,padding:"9px 12px",fontSize:12,color:t.info,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                  <span>Use market price</span>
                  <Btn small variant="info" onClick={()=>setSalePrice(String(marketVal))}>Use {fmt(marketVal)}</Btn>
                </div>
              )}
            </div>
          )}
          <Inp label="Sale price (₱)" type="number" min="0.01" step="0.01" value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="5000" data-sell-price-input="1" error={attempted&&!(sp>0)?"Enter an amount above ₱0.":undefined}/>
          {selId&&sp>0&&(
            <div style={{background:t.surfaceSunken,borderRadius:9,padding:13,border:`1px solid ${t.border}`,animation:"blFadeUp 0.2s ease"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{color:t.textMuted}}>Cost</span><span style={{fontFamily:FONT_MONO}}>{fmt(cost)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:6}}><span style={{color:t.textMuted}}>Sale price</span><span style={{fontFamily:FONT_MONO}}>{fmt(sp)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,paddingTop:8,borderTop:`1px solid ${t.border}`}}><span style={{color:t.textMuted}}>Profit</span><span style={{fontFamily:FONT_MONO,fontWeight:700,color:profit>=0?t.positive:t.negative}}>{profit>=0?"+":""}{fmt(profit)} ({pct(margin)})</span></div>
            </div>
          )}
          <div><div style={{fontSize:12.5,color:t.textMuted,fontWeight:500,marginBottom:6}}>Receive payment into</div><Segmented ariaLabel="Receive payment into" value={paymentAccount} onChange={setPaymentAccount} options={[["bank","Business Bank",Wallet],["cash","Cash",Banknote]]}/></div>
          <details style={{fontSize:12,color:t.textMuted}}>
            <summary style={{cursor:"pointer",width:"fit-content"}}>Sale details (optional)</summary>
            <div style={{display:"flex",flexDirection:"column",gap:14,marginTop:12}}>
              <Inp label="Buyer name" value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="Juan dela Cruz"/>
              <Inp label="Conversation link" value={convoLink} onChange={e=>setConvoLink(e.target.value)} placeholder="https://m.me/... or FB Marketplace chat link" icon={LinkIcon}/>
              <PhotoUpload label="Proof of transaction — screenshot or photo" photoUrl={proofPhoto.photoUrl} photoRecordId={proofPhoto.photoRecordId} onChange={setProofPhoto}/>
            </div>
          </details>
          <Btn variant="success" icon={Check} loading={loading} onClick={submit} disabled={loading} style={{width:"100%"}}>Record sale</Btn>
        </div>
      </Card>
    </div>
  );
}
