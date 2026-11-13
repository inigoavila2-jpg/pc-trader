import { useState, useRef, useCallback } from "react";

import { Boxes, Banknote, Settings as SettingsIcon, Plus, Trash2, Copy, Wallet, Cpu } from "lucide-react";
import { fmt, pct, today, uid } from "../data/model.js";
import { FONT_DISPLAY, FONT_MONO, useTheme, PhotoUpload, Card, Btn, IconBtn, Inp, CategoryPicker, PageHeader, DealBar, Segmented } from "../components/index.js";
import { CategoryManager } from "../components/CategoryManager.jsx";
import { usePersistentState } from "../hooks/appHooks.js";
import { Inventory } from "./Inventory.jsx";
import { Builds } from "./Builds.jsx";
import { Sell } from "./Sell.jsx";
import { History } from "./History.jsx";

export function Buy({state,dispatch,toast}) {
  const t=useTheme();
  const [categoryManagerOpen,setCategoryManagerOpen]=useState(false);
  const [mode,setMode]=useState("bundle");
  const [bundleName,setBundleName]=useState("");
  const [purchasePrice,setPurchasePrice]=useState("");
  const [purchaseAccount,setPurchaseAccount]=usePersistentState("pctrader:lastPurchaseAccount","bank");
  const [bundlePhoto,setBundlePhoto]=useState({photoUrl:"",photoRecordId:""});
  // Smart default: start each new row on whatever category was bought last, instead of
  // always resetting to GPU — most buying sessions are one category at a time (a batch of
  // RAM, a batch of PSUs), so this saves a re-pick almost every time.
  const [lastCategory,setLastCategory]=usePersistentState("pctrader:lastCategory","GPU");
  const [partRows,setPartRows]=useState([{id:uid(),name:"",category:lastCategory,marketValue:"",notes:"",photoUrl:"",photoRecordId:""}]);
  const [singleName,setSingleName]=useState("");
  const [singleCat,setSingleCat]=useState(lastCategory);
  const [singleCost,setSingleCost]=useState("");
  const [singleMarket,setSingleMarket]=useState("");
  const [singleQty,setSingleQty]=useState("1");
  const [singleNotes,setSingleNotes]=useState("");
  const [singlePhoto,setSinglePhoto]=useState({photoUrl:"",photoRecordId:""});
  const [loading,setLoading]=useState(false);
  const [bundleAttempted,setBundleAttempted]=useState(false);
  const [singleAttempted,setSingleAttempted]=useState(false);
  const lastRowMarketRef=useRef(null);

  const totalMarket=partRows.reduce((s,r)=>s+(parseFloat(r.marketValue)||0),0);
  const paid=parseFloat(purchasePrice)||0;
  const dealScore=paid>0&&totalMarket>0?totalMarket/paid:null;

  const addRow=()=>{
    setPartRows(p=>[...p,{id:uid(),name:"",category:p[p.length-1]?.category||lastCategory,marketValue:"",notes:"",photoUrl:"",photoRecordId:""}]);
    // Focus lands on the new row's name field once it exists in the DOM.
    requestAnimationFrame(()=>{
      const inputs=document.querySelectorAll('[data-buy-row-name="1"]');
      inputs[inputs.length-1]?.focus();
    });
  };
  const removeRow=id=>setPartRows(p=>p.filter(r=>r.id!==id));
  const updateRow=(id,field,val)=>setPartRows(p=>p.map(r=>r.id===id?{...r,[field]:val}:r));
  // Fewer clicks: Enter in the last row's market-value field adds the next row directly,
  // so a whole bundle can be entered without reaching for the mouse.
  const handleLastRowKeyDown=e=>{
    if(e.key==="Enter"){e.preventDefault();addRow();}
  };

  // Speed feature: duplicate the most recent bundle's structure (names/categories) so
  // re-buying a similar batch doesn't mean re-typing everything from scratch.
  const analyzeBundlePhoto=useCallback(async(dataUrl)=>{
    const result=await analyzeBuyImage(dataUrl,{mode:"bundle",existingRows:partRows});
    if(result.source) setBundleName(result.source);
    if(result.purchasePrice) setPurchasePrice(String(result.purchasePrice));
    if(result.parts.length){
      setPartRows(prev=>result.parts.map((p,i)=>({
        id:prev[i]?.id||uid(),
        name:p.name||prev[i]?.name||"",
        category:p.category||prev[i]?.category||lastCategory,
        marketValue:p.marketValue||prev[i]?.marketValue||"",
        notes:p.notes||prev[i]?.notes||"",
        photoUrl:prev[i]?.photoUrl||"",
        photoRecordId:prev[i]?.photoRecordId||"",
      })));
      const last=result.parts[result.parts.length-1];
      if(last?.category) setLastCategory(last.category);
      toast(`AI identified ${result.parts.length} part${result.parts.length===1?"":"s"} from the bundle photo`,"success");
    }else{
      toast("AI could not confidently identify the bundle parts — review the photo and enter them manually","warn");
    }
    return result;
  },[partRows,setLastCategory,toast]);

  const analyzeSinglePhoto=useCallback(async(dataUrl)=>{
    const result=await analyzeBuyImage(dataUrl,{mode:"single"});
    if(result.name) setSingleName(result.name);
    if(result.category) setSingleCat(result.category);
    if(result.notes) setSingleNotes(result.notes);
    if(result.marketValue) setSingleMarket(String(result.marketValue));
    if(result.quantity>1) setSingleQty(String(result.quantity));
    if(result.category) setLastCategory(result.category);
    toast(result.name?`AI identified ${result.name}`:"AI analyzed the photo — please review the fields", "success");
    return result;
  },[setLastCategory,toast]);

  const analyzeRowPhoto=useCallback((rowId)=>(dataUrl)=>analyzeBuyImage(dataUrl,{mode:"single"}).then(result=>{
    if(result.name) updateRow(rowId,"name",result.name);
    if(result.category) updateRow(rowId,"category",result.category);
    if(result.notes) updateRow(rowId,"notes",result.notes);
    if(result.marketValue) updateRow(rowId,"marketValue",String(result.marketValue));
    return result;
  }),[]);

  const duplicateLastBundle=()=>{
    const last=state.bundles[state.bundles.length-1];
    if(!last)return;
    const lastParts=state.parts.filter(p=>p.bundleId===last.id);
    setBundleName(last.name);
    setPartRows(lastParts.length?lastParts.map(p=>({id:uid(),name:p.name,category:p.category,marketValue:"",notes:"",photoUrl:"",photoRecordId:""})):[{id:uid(),name:"",category:lastCategory,marketValue:"",notes:"",photoUrl:"",photoRecordId:""}]);
    toast(`Loaded structure from "${last.name}" — update prices`);
  };

  const submitBundle=()=>{
    setBundleAttempted(true);
    const filledRows=partRows.filter(r=>r.name.trim()||r.marketValue);
    const incompleteRow=filledRows.some(r=>!r.name.trim()||!(Number(r.marketValue)>0));
    if(!bundleName.trim()||!(paid>0)||totalMarket===0||incompleteRow){toast("Enter a source, purchase price, and complete part names and market values","error");return;}
    setLoading(true);
    setTimeout(()=>{
      const bundleId=uid();
      const num=state.bundles.length+1;
      const src=`Bundle #${String(num).padStart(3,"0")} — ${bundleName}`;
      const newParts=partRows.filter(r=>r.name&&r.marketValue).map(r=>{
        const mv=parseFloat(r.marketValue);
        const share=mv/totalMarket;
        const alloc=share*paid;
        return {id:uid(),name:r.name,category:r.category,marketValue:mv,allocatedCost:alloc,
          source:src,bundleId,status:"available",notes:r.notes||"",soldTo:"",
          photoUrl:r.photoUrl||"",photoRecordId:r.photoRecordId||"",
          history:[{date:today(),event:`Bought via ${src} — allocated ${fmt(alloc)}`}]};
      });
      dispatch({type:"ADD_BUNDLE",paymentAccount:purchaseAccount,bundle:{id:bundleId,name:bundleName,purchasePrice:paid,totalMarket,date:today(),
        photoUrl:bundlePhoto.photoUrl,photoRecordId:bundlePhoto.photoRecordId},parts:newParts});
      toast(`Bundle added — ${newParts.length} parts in inventory`);
      if(newParts.length)setLastCategory(newParts[newParts.length-1].category);
      setBundleName("");setPurchasePrice("");setPartRows([{id:uid(),name:"",category:newParts.length?newParts[newParts.length-1].category:lastCategory,marketValue:"",notes:"",photoUrl:"",photoRecordId:""}]);
      setBundlePhoto({photoUrl:"",photoRecordId:""});
      setBundleAttempted(false);
      setLoading(false);
    },400);
  };

  const submitSingle=()=>{
    setSingleAttempted(true);
    if(!singleName.trim()||!(Number(singleCost)>0)){toast("Enter a part name and a cost above zero","error");return;}
    setLoading(true);
    setTimeout(()=>{
      const cost=parseFloat(singleCost);
      const market=parseFloat(singleMarket)||cost;
      const qty=Math.max(1,parseInt(singleQty,10)||1);
      // Quantity creates N independent part records (each with its own id/status/history) rather
      // than a shared "count" field — every other part of the app (Inventory, Builds picker, Sell,
      // History) already works in terms of one trackable item per status, so N separate records is
      // what lets each unit be individually put in a build, sold, or marked defective on its own.
      const newParts=Array.from({length:qty},()=>({
        id:uid(),name:singleName,category:singleCat,marketValue:market,
        allocatedCost:cost,source:"Direct purchase",bundleId:null,status:"available",notes:singleNotes,soldTo:"",
        photoUrl:singlePhoto.photoUrl,photoRecordId:singlePhoto.photoRecordId,
        history:[{date:today(),event:`Bought for ${fmt(cost)}`}]}));
      dispatch({type:"ADD_PARTS",paymentAccount:purchaseAccount,parts:newParts});
      toast(qty>1?`${qty}× ${singleName} added`:`${singleName} added`);
      setLastCategory(singleCat);
      setSingleName("");setSingleCost("");setSingleMarket("");setSingleQty("1");setSingleNotes("");
      setSingleAttempted(false);
      setSinglePhoto({photoUrl:"",photoRecordId:""});
      setLoading(false);
    },300);
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {categoryManagerOpen&&<CategoryManager state={state} dispatch={dispatch} toast={toast} onClose={()=>setCategoryManagerOpen(false)}/>}
      <PageHeader title="Buy parts" sub="Add a bundle PC or an individual part."/>
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:-8}}>
        <Btn small variant="ghost" icon={SettingsIcon} onClick={()=>setCategoryManagerOpen(true)}>Manage categories</Btn>
      </div>
      <Segmented ariaLabel="Purchase type" value={mode} onChange={setMode} options={[["bundle","Bundle PC",Boxes],["single","Single part",Cpu]]}/>

      {mode==="bundle"&&(
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,gap:10,flexWrap:"wrap"}}>
            <div style={{fontWeight:700,fontSize:13.5,color:t.text,fontFamily:FONT_DISPLAY}}>Bundle details</div>
            {state.bundles.length>0&&(
              <Btn small variant="ghost" icon={Copy} onClick={duplicateLastBundle}>Duplicate last bundle</Btn>
            )}
          </div>
          <div className="responsive-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:20}}>
            <Inp label="Source / seller" value={bundleName} onChange={e=>setBundleName(e.target.value)} placeholder="FB Marketplace – Juan" error={bundleAttempted&&!bundleName.trim()?"Enter who or where you bought it from.":undefined}/>
            <Inp label="Purchase price (₱)" type="number" min="0.01" step="0.01" value={purchasePrice} onChange={e=>setPurchasePrice(e.target.value)} placeholder="8000" error={bundleAttempted&&!(paid>0)?"Enter an amount above ₱0.":undefined}/>
            <div>
              <div style={{fontSize:11.5,color:t.textMuted,marginBottom:6,fontWeight:600}}>Payment source</div>
              <Segmented ariaLabel="Payment source" value={purchaseAccount} onChange={setPurchaseAccount} options={[["bank","Business Bank",Wallet],["cash","Cash",Banknote]]}/>
            </div>
          </div>
          <div style={{fontWeight:700,fontSize:13,color:t.text,marginBottom:12,fontFamily:FONT_DISPLAY}}>Parts — enter estimated market value</div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            {partRows.map((row,idx)=>(
              <div key={row.id} style={{display:"flex",gap:10,alignItems:"flex-start",animation:"blFadeUp 0.15s ease",paddingBottom:14,borderBottom:idx<partRows.length-1?`1px solid ${t.border}`:"none"}}>
                <div className="part-row" style={{display:"grid",gridTemplateColumns:"1fr auto 90px auto",gap:8,alignItems:"end",flex:1}}>
                  <Inp label={idx===0?"Part name":""} value={row.name} onChange={e=>updateRow(row.id,"name",e.target.value)} placeholder="RX 580" data-buy-row-name="1" error={bundleAttempted&&(row.name.trim()||row.marketValue)&&!row.name.trim()?"Add a part name.":undefined}/>
                  <CategoryPicker label={idx===0?"Category":"​"} value={row.category} onChange={v=>updateRow(row.id,"category",v)} customCategories={state.customCategories} hiddenCategories={state.hiddenCategories||[]} dispatch={dispatch} style={{minWidth:90}}/>
                  <Inp label={idx===0?"Market (₱)":""} type="number" min="0.01" step="0.01" value={row.marketValue} onChange={e=>updateRow(row.id,"marketValue",e.target.value)} placeholder="4000" error={bundleAttempted&&(row.name.trim()||row.marketValue)&&!(Number(row.marketValue)>0)?"Enter a value above ₱0.":undefined}
                    onKeyDown={idx===partRows.length-1?handleLastRowKeyDown:undefined}/>
                  <IconBtn icon={Trash2} label={`Remove ${row.name||"part row"}`} variant="danger" onClick={()=>removeRow(row.id)} style={{alignSelf:idx===0?"end":"start",marginBottom:idx===0?2:0}}/>
                  <details style={{gridColumn:"1 / -1",fontSize:12,color:t.textMuted}}>
                    <summary style={{cursor:"pointer",width:"fit-content"}}>Photo and notes (optional)</summary>
                    <div style={{display:"flex",alignItems:"flex-end",gap:12,flexWrap:"wrap",marginTop:10}}>
                      <PhotoUpload label={`Photo for ${row.name||"part"}`} photoUrl={row.photoUrl} photoRecordId={row.photoRecordId} onChange={({photoUrl,photoRecordId})=>{updateRow(row.id,"photoUrl",photoUrl);updateRow(row.id,"photoRecordId",photoRecordId);}} onAnalyze={analyzeRowPhoto(row.id)}/>
                      <div style={{flex:"1 1 180px"}}><Inp label="Notes" value={row.notes||""} onChange={e=>updateRow(row.id,"notes",e.target.value)} placeholder="Condition, extras"/></div>
                    </div>
                  </details>
                </div>
              </div>
            ))}
          </div>
          <div style={{marginTop:12}}><Btn small variant="ghost" icon={Plus} onClick={addRow}>Add part <span style={{opacity:0.6,fontWeight:400}}>(or press Enter in Market)</span></Btn></div>

          <details style={{marginTop:14,fontSize:12,color:t.textMuted}}>
            <summary style={{cursor:"pointer",width:"fit-content"}}>Bundle photo and AI entry (optional)</summary>
            <div style={{marginTop:10}}><PhotoUpload label="Bundle photo" photoUrl={bundlePhoto.photoUrl} photoRecordId={bundlePhoto.photoRecordId} onChange={setBundlePhoto} onAnalyze={analyzeBundlePhoto}/></div>
          </details>

          {(paid>0||totalMarket>0)&&(
            <div style={{marginTop:16,background:t.surfaceSunken,borderRadius:10,padding:14,border:`1px solid ${t.border}`}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                <span style={{color:t.textMuted}}>Market value</span><span style={{fontFamily:FONT_MONO,color:t.text}}>{fmt(totalMarket)}</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:10}}>
                <span style={{color:t.textMuted}}>You pay</span><span style={{fontFamily:FONT_MONO,color:t.text}}>{fmt(paid)}</span>
              </div>
              {dealScore!==null&&<DealBar score={dealScore}/>}
              {paid>0&&totalMarket>0&&<div style={{fontSize:12,color:totalMarket>=paid?t.positive:t.negative,marginTop:8}}>Estimated value above purchase cost: {fmt(totalMarket-paid)}</div>}
              {dealScore!==null&&<div style={{marginTop:12,borderTop:`1px solid ${t.border}`,paddingTop:10}}>
                {partRows.filter(r=>r.name&&r.marketValue).map(r=>{
                  const mv=parseFloat(r.marketValue)||0;
                  const share=totalMarket>0?mv/totalMarket:0;
                  return <div key={r.id} style={{display:"flex",justifyContent:"space-between",fontSize:11.5,marginBottom:4}}>
                    <span style={{color:t.textFaint}}>{r.name} ({pct(share)})</span>
                    <span style={{fontFamily:FONT_MONO,color:t.textMuted}}>{fmt(share*paid)}</span>
                  </div>;
                })}
              </div>}
            </div>
          )}
          <div style={{marginTop:16}}><Btn loading={loading} onClick={submitBundle} disabled={loading} style={{width:"100%"}}>Add bundle to inventory</Btn></div>
        </Card>
      )}

      {mode==="single"&&(
        <Card>
          <div style={{fontWeight:700,fontSize:13.5,color:t.text,marginBottom:16,fontFamily:FONT_DISPLAY}}>Single part</div>
          <div className="responsive-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <Inp label="Part name" value={singleName} onChange={e=>setSingleName(e.target.value)} placeholder="GTX 1060 6GB" error={singleAttempted&&!singleName.trim()?"Enter a part name.":undefined}/>
            <CategoryPicker label="Category" value={singleCat} onChange={setSingleCat} customCategories={state.customCategories} hiddenCategories={state.hiddenCategories||[]} dispatch={dispatch}/>
            <Inp label="Cost (₱, per unit)" type="number" min="0.01" step="0.01" value={singleCost} onChange={e=>setSingleCost(e.target.value)} placeholder="3000" error={singleAttempted&&!(Number(singleCost)>0)?"Enter an amount above ₱0.":undefined}/>
            <Inp label="Quantity" type="number" min="1" value={singleQty} onChange={e=>setSingleQty(e.target.value)} placeholder="1"/>
          </div>
          {singleCost&&Number(singleCost)>0&&(
            <div style={{marginTop:12,background:t.surfaceSunken,border:`1px solid ${t.border}`,borderRadius:9,padding:"10px 12px",
              display:"flex",justifyContent:"space-between",fontSize:12}}>
              <span style={{color:t.textMuted}}>{Math.max(1,parseInt(singleQty,10)||1)} units × {fmt(parseFloat(singleCost)||0)}</span>
              <span style={{fontFamily:FONT_MONO,fontWeight:700,color:t.text}}>{fmt((Math.max(1,parseInt(singleQty,10)||1))*(parseFloat(singleCost)||0))} total</span>
            </div>
          )}
          <div style={{marginTop:14}}>
            <div style={{fontSize:11.5,color:t.textMuted,marginBottom:6,fontWeight:600}}>Payment source</div>
            <Segmented ariaLabel="Payment source" value={purchaseAccount} onChange={setPurchaseAccount} options={[["bank","Business Bank",Wallet],["cash","Cash",Banknote]]}/>
          </div>
          <details style={{marginTop:14,fontSize:12,color:t.textMuted}}>
            <summary style={{cursor:"pointer",width:"fit-content"}}>Market value, photo, and notes (optional)</summary>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginTop:10}}>
              <Inp label="Market value (₱, per unit)" type="number" value={singleMarket} onChange={e=>setSingleMarket(e.target.value)} placeholder="3500"/>
              <Inp label="Notes" value={singleNotes} onChange={e=>setSingleNotes(e.target.value)} placeholder="Tested working. Includes original box."/>
              <PhotoUpload label="Photo" photoUrl={singlePhoto.photoUrl} photoRecordId={singlePhoto.photoRecordId} onChange={setSinglePhoto} onAnalyze={analyzeSinglePhoto}/>
            </div>
          </details>
          <div style={{marginTop:16}}><Btn loading={loading} onClick={submitSingle} disabled={loading} style={{width:"100%"}}>{parseInt(singleQty,10)>1?`Add ${Math.max(1,parseInt(singleQty,10)||1)} to inventory`:"Add to inventory"}</Btn></div>
        </Card>
      )}
    </div>
  );
}
