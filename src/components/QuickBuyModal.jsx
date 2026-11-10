import { useState } from "react";

import { ShoppingCart, Banknote, Wallet } from "lucide-react";
import { fmt, today, uid } from "../data/model.js";
import { FONT_DISPLAY, useTheme } from "./theme.js";
import { usePersistentState } from "../hooks/appHooks.js";
import { ModalShell } from "./ModalShell.jsx";
import { Btn } from "./Btn.jsx";
import { Inp } from "./Inp.jsx";
import { CategoryPicker } from "./CategoryPicker.jsx";
import { Segmented } from "./Segmented.jsx";
import { Buy } from "../pages/Buy.jsx";

export function QuickBuyModal({state,dispatch,toast,onClose}) {
  const t=useTheme();
  const [name,setName]=useState("");
  const [cat,setCat]=useState("Other");
  const [cost,setCost]=useState("");
  const [qty,setQty]=useState("1");
  const [purchaseAccount,setPurchaseAccount]=usePersistentState("pctrader:lastPurchaseAccount","bank");

  const submit=()=>{
    if(!name||!cost){toast("Enter a name and cost","error");return;}
    const c=parseFloat(cost);
    const n=Math.max(1,parseInt(qty,10)||1);
    const newParts=Array.from({length:n},()=>({id:uid(),name,category:cat,marketValue:c,allocatedCost:c,
      source:"Quick Buy",bundleId:null,status:"available",notes:"",soldTo:"",photoUrl:"",photoRecordId:"",
      history:[{date:today(),event:`Quick Buy — bought for ${fmt(c)}`}]}));
    dispatch({type:"ADD_PARTS",paymentAccount:purchaseAccount,parts:newParts});
    toast(n>1?`${n}× ${name} added — add photos/details later via Edit`:`${name} added — add photos/details later via Edit`);
    onClose();
  };

  return (
    <ModalShell onClose={onClose} label="Quick buy">
      <div style={{fontWeight:700,fontSize:16,color:t.text,marginBottom:4,fontFamily:FONT_DISPLAY,display:"flex",alignItems:"center",gap:8}}><ShoppingCart size={17} color={t.accent}/>Quick buy</div>
      <div style={{fontSize:12,color:t.textFaint,marginBottom:16}}>Lock it in fast — fill in the rest later.</div>
      <div style={{display:"flex",flexDirection:"column",gap:11}}>
        <Inp label="Name" value={name} onChange={e=>setName(e.target.value)} placeholder="RX 580"/>
        <CategoryPicker label="Category" value={cat} onChange={setCat} customCategories={state.customCategories} hiddenCategories={state.hiddenCategories||[]} dispatch={dispatch}/>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
          <Inp label="Cost (₱, per unit)" type="number" value={cost} onChange={e=>setCost(e.target.value)} placeholder="3000"/>
          <Inp label="Qty" type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)} placeholder="1"/>
        </div>
        <div><div style={{fontSize:12.5,color:t.textMuted,fontWeight:500,marginBottom:6}}>Payment source</div><Segmented ariaLabel="Payment source" value={purchaseAccount} onChange={setPurchaseAccount} options={[["bank","Business Bank",Wallet],["cash","Cash",Banknote]]}/></div>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <Btn onClick={submit} style={{flex:1}}>{parseInt(qty,10)>1?`Add ${Math.max(1,parseInt(qty,10)||1)} to inventory`:"Add to inventory"}</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
      </div>
    </ModalShell>
  );
}

